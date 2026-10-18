import { configure, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/errors';
import * as contractsApi from '../../api/contracts';
import * as scheduleApi from '../../api/schedule';
import { ContractList } from './ContractList';

// Danh sách hợp đồng đọc ?customerId=… (màn Khách hàng dẫn sang "Xem tất cả n hợp đồng").

vi.mock('../../api/contracts', () => ({ listContracts: vi.fn() }));
vi.mock('../../api/schedule', () => ({ getCustomer: vi.fn() }));
configure({ asyncUtilTimeout: 5000 });

const list = vi.mocked(contractsApi.listContracts);
const getCustomer = vi.mocked(scheduleApi.getCustomer);

const ROW = {
  id: 'hd-1',
  code: 'HĐ-000001',
  status: 'DRAFT',
  eventDate: '2026-11-21T17:00:00.000Z',
  total: 1_950_000,
  customer: { id: 'c-1', fullName: 'Lê Thu Trang', phone: null },
};

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

function renderList(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/studio/hop-dong"
          element={
            <>
              <ContractList orgId="org-1" slug="studio" tz="Asia/Ho_Chi_Minh" canCreate />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ items: [ROW], page: 1, pageSize: 20, total: 1 } as never);
});

describe('lọc theo khách (?customerId=)', () => {
  it('khách thuộc tổ chức → gọi danh sách kèm customerId, dải "Đang lọc theo khách {tên} · Bỏ lọc"; Bỏ lọc → hết lọc', async () => {
    getCustomer.mockResolvedValue({ id: 'c-1', fullName: 'Lê Thu Trang', phone: null, email: null } as never);
    renderList('/studio/hop-dong?customerId=c-1');
    const band = await screen.findByText(/Đang lọc theo khách/);
    expect(band.textContent).toContain('Lê Thu Trang');
    await waitFor(() => expect(list).toHaveBeenCalledWith('org-1', expect.objectContaining({ customerId: 'c-1' }), expect.anything()));
    // Không gọi danh sách chưa lọc trước khi biết khách.
    expect(list.mock.calls.every((c) => (c[1] as { customerId?: string }).customerId === 'c-1')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/studio/hop-dong'));
    await waitFor(() => expect((list.mock.calls.at(-1)?.[1] as { customerId?: string }).customerId).toBeUndefined());
    expect(screen.queryByText(/Đang lọc theo khách/)).toBeNull();
  });

  it('mã lạ / không thuộc tổ chức (404) → bỏ lọc, báo một dòng, danh sách không gửi customerId', async () => {
    getCustomer.mockRejectedValue(new ApiError('NOT_FOUND', 'Không tìm thấy khách hàng', 404, 'r'));
    renderList('/studio/hop-dong?customerId=khong-co');
    expect(await screen.findByText('Không tìm thấy khách này trong tổ chức — đang hiện tất cả hợp đồng.')).toBeTruthy();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(list.mock.calls.every((c) => (c[1] as { customerId?: string }).customerId === undefined)).toBe(true);
    expect(screen.queryByText(/Đang lọc theo khách/)).toBeNull();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/studio/hop-dong'));
  });

  it('không có customerId → không hỏi khách, danh sách không lọc', async () => {
    renderList('/studio/hop-dong');
    await screen.findByText('Lê Thu Trang');
    expect(getCustomer).not.toHaveBeenCalled();
    expect((list.mock.calls[0]?.[1] as { customerId?: string }).customerId).toBeUndefined();
    expect(screen.queryByText(/Đang lọc theo khách/)).toBeNull();
  });
});
