import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { PaymentMethod } from '@makeup/shared';
import { errorKind, userMessage } from '../../api/errors';
import type { Payment, PaymentResult } from '../../api/types';
import { ForbiddenBanner } from '../../layout/ErrorStates';
import { Button, Card, ContractStatusTag, EmptyState, IconBack, IconWarn, Skeleton, SkeletonText } from '../../ui';
import { InstallmentsCard } from './InstallmentsCard';
import { InstallmentsDialog } from './InstallmentsDialog';
import { prefillAmount } from './model';
import { PaymentForm } from './PaymentForm';
import { PaymentsCard } from './PaymentsCard';
import { SummaryTiles, SummaryTilesSkeleton } from './SummaryTiles';
import { usePaymentProgress } from './usePaymentProgress';
import { VoidPaymentDialog } from './VoidPaymentDialog';
import { fmtDate } from './vnTime';

export interface PaymentAccess {
  /** payments.write: thẻ "Ghi phiếu thu", nút "Sửa tiến độ" / "Lập tiến độ". */
  write: boolean;
  /** payments.void: "Hoàn tiền" trong Loại phiếu, nút "Huỷ phiếu". */
  void: boolean;
}

export interface PaymentPanelProps {
  orgId: string;
  orgSlug: string;
  contractId: string;
  access: PaymentAccess;
  /**
   * Dòng phụ của thẻ đầu, sau mã hợp đồng. Mặc định (dịch vụ makeup): "Sự kiện dd/mm/yyyy · SĐT".
   * Hợp đồng khoá học truyền dòng của mình (lớp, phụ trách) — phần còn lại của khối giữ nguyên.
   */
  renderSubline?: (c: { eventDate: string | null; phone: string | null }) => ReactNode;
  /** Đường "Về danh sách" khi 404. */
  backTo: string;
  /** Mã hợp đồng vừa tải (màn đặt làm tiêu đề thanh trên điện thoại). */
  onLoaded?: (code: string) => void;
}

function defaultSubline(c: { eventDate: string | null; phone: string | null }) {
  return (
    <>
      {c.eventDate ? ` · Sự kiện ${fmtDate(c.eventDate)}` : ' · Chưa có ngày sự kiện'}
      {c.phone ? ` · ${c.phone}` : ''}
    </>
  );
}

/**
 * Khối phải màn Thu tiền (bản vẽ C2 mục 3.2): thẻ đầu + 4 ô số · Tiến độ thanh toán | Phiếu đã ghi · Ghi phiếu thu.
 * Dùng chung cho mọi hợp đồng (dịch vụ makeup, khoá học) — chỉ khác dòng phụ thẻ đầu (renderSubline).
 */
export function PaymentPanel({ orgId, orgSlug, contractId, access, renderSubline = defaultSubline, backTo, onLoaded }: PaymentPanelProps) {
  const progress = usePaymentProgress(orgId, contractId);
  const [planOpen, setPlanOpen] = useState(false);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [lastMethod, setLastMethod] = useState<PaymentMethod | null>(null);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { state } = progress;

  const loadedCode = state.status === 'ready' ? state.data.contract.code : null;
  useEffect(() => {
    if (loadedCode) onLoaded?.(loadedCode);
  }, [loadedCode, onLoaded]);

  // Sau khi ghi/huỷ phiếu: 4 ô số thay bằng summary máy chủ trả ngay; tải lại để có trạng thái đợt và danh sách phiếu.
  function afterChange(result: PaymentResult, message: string) {
    progress.applySummary(result.summary);
    setNotice(message);
    setReloadError(null);
    progress
      .reload()
      .then(() => setFormVersion((v) => v + 1))
      .catch((err: unknown) => setReloadError(`Đã lưu nhưng chưa tải lại được danh sách: ${userMessage(err)}`));
  }

  if (state.status === 'loading') {
    return (
      <div className="pm-panel" aria-busy="true">
        <Card className="pm-card">
          <div className="pm-head">
            <Skeleton width={220} height={20} />
            <Skeleton width={300} height={12} style={{ marginTop: 8 }} />
          </div>
          <SummaryTilesSkeleton />
        </Card>
        <div className="pm-two">
          {['Tiến độ thanh toán', 'Phiếu đã ghi'].map((t) => (
            <Card key={t} title={t} className="pm-card">
              <SkeletonText lines={3} widths={['80%', '60%', '70%']} label={`Đang tải ${t.toLowerCase()}`} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    const kind = errorKind(state.error);
    if (kind === 'not_found') {
      return (
        <Card className="pm-card">
          <EmptyState
            message="Không tìm thấy hợp đồng"
            action={
              <Link to={backTo} className="ui-btn" style={{ textDecoration: 'none' }}>
                <IconBack />
                <span className="ui-btn__text">Về danh sách</span>
              </Link>
            }
          />
        </Card>
      );
    }
    if (kind === 'forbidden') return <ForbiddenBanner>{userMessage(state.error)}</ForbiddenBanner>;
    return (
      <Card className="pm-card">
        <EmptyState message={userMessage(state.error)} action={<Button onClick={progress.retry}>Thử lại</Button>} />
      </Card>
    );
  }

  const data = state.data;
  const c = data.contract;
  return (
    <div className="pm-panel" data-hop-dong={c.code}>
      {(notice || reloadError) && (
        <div className={`pm-band ${reloadError ? 'pm-band--warn' : 'pm-band--ok'}`} role="status">
          {reloadError ? <IconWarn /> : null}
          <span>{reloadError ?? notice}</span>
          <button type="button" className="pm-linkbtn pm-band__x" onClick={() => (setNotice(null), setReloadError(null))}>
            Ẩn
          </button>
        </div>
      )}
      <Card className="pm-card">
        <div className="pm-head">
          <div className="pm-head__top">
            <ContractStatusTag status={c.status} />
            <h2 className="pm-head__name">{c.customer.fullName}</h2>
          </div>
          <div className="pm-fx pm-head__sub">
            {c.code}
            {renderSubline({ eventDate: c.eventDate, phone: c.customer.phone })} ·{' '}
            <Link to={`/${orgSlug}/hop-dong/${c.id}`}>Mở hợp đồng</Link>
          </div>
        </div>
        <SummaryTiles summary={data.summary} />
      </Card>
      <div className="pm-two">
        <InstallmentsCard data={data} canWrite={access.write} onEdit={() => setPlanOpen(true)} />
        <PaymentsCard payments={data.payments} canVoid={access.void} onVoid={setVoiding} />
      </div>
      {access.write && (
        <PaymentForm
          key={`${c.id}:${formVersion}`}
          orgId={orgId}
          contractId={c.id}
          initialAmount={prefillAmount(data)}
          initialMethod={lastMethod}
          canRefund={access.void}
          onSaved={(result, method) => {
            setLastMethod(method);
            afterChange(result, `Đã ghi ${result.kind === 'REFUND' ? 'phiếu hoàn' : 'phiếu thu'} ${result.code}.`);
          }}
        />
      )}
      {access.write && (
        <InstallmentsDialog
          open={planOpen}
          orgId={orgId}
          data={data}
          onClose={() => setPlanOpen(false)}
          onSaved={(next) => {
            progress.replace(next);
            setPlanOpen(false);
            setFormVersion((v) => v + 1);
            setNotice(next.installments.length > 0 ? 'Đã lưu tiến độ thanh toán.' : 'Đã bỏ tiến độ thanh toán.');
          }}
        />
      )}
      {access.void && (
        <VoidPaymentDialog
          orgId={orgId}
          payment={voiding}
          onClose={() => setVoiding(null)}
          onDone={(result) => {
            setVoiding(null);
            afterChange(result, `Đã huỷ phiếu ${result.code}.`);
          }}
        />
      )}
    </div>
  );
}
