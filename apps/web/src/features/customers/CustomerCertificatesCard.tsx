import { lazy, Suspense, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { OrgKind } from '../../api/auth';
import { listCertificates, type CertificateView } from '../../api/certificates';
import { userMessage } from '../../api/errors';
import { useBreakpoint, type Breakpoint } from '../../layout/useBreakpoint';
import { usePermissions } from '../../layout/usePermissions';
import { Button, Card, Dialog, Skeleton, StatusTag } from '../../ui';
import type { RenderDeps } from '../certificates/render';
import { LoadErrorStrip } from '../staff/parts';
import { useLoad } from '../staff/useOrgInfo';
import { certificatePrintNames, certificateRegisterPath, certificateStatus, certificateSub, certificateTitle } from './logic';
import './CustomerCertificatesCard.css';

// Thẻ "Giấy chứng nhận" trong hồ sơ học viên (bản vẽ F mục 6.6; ký duyệt F câu 1: In lại = ẢNH LÚC CẤP).
// Chỉ hiện khi tổ chức là ACADEMY và người xem có certificates.read. Học viên chưa có giấy nào → ẩn thẻ.
// Mỗi giấy: "{khoá} · {lớp}", "{số} · cấp dd/mm/yyyy", trạng thái (bản cấp lại / đã thu hồi). Giấy còn hiệu lực có nút "In lại".
// Bản in là PrintSheet của W2 (tải khi bấm: không kéo bộ vẽ + PDF vào tệp Khách hàng).

const PrintSheet = lazy(() => import('../certificates/PrintSheet').then((m) => ({ default: m.PrintSheet })));

// Máy chủ cho tối đa 100 dòng một trang; học viên có nhiều hơn thì cuối thẻ có "Xem trong sổ".
export const CUSTOMER_CERT_LIMIT = 100;

export interface CustomerCertificatesCardProps {
  orgId: string;
  slug: string;
  customerId: string;
  orgKind: OrgKind | undefined;
  // Ghi đè khổ màn / bộ vẽ cho bài thử; không truyền thì theo màn thật.
  breakpoint?: Breakpoint;
  renderDeps?: Partial<RenderDeps>;
}

export function CustomerCertificatesCard(props: CustomerCertificatesCardProps) {
  const has = usePermissions();
  if (props.orgKind !== 'ACADEMY' || !has('certificates.read')) return null;
  return <CustomerCertificatesBody {...props} />;
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="ui-ico">
      <path d="M7 9V3h10v6M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2M7 14h10v7H7z" />
    </svg>
  );
}

function CustomerCertificatesBody({ orgId, slug, customerId, breakpoint, renderDeps }: CustomerCertificatesCardProps) {
  const detected = useBreakpoint();
  const bp = breakpoint ?? detected;
  const load = useLoad((signal) => listCertificates(orgId, { customerId, pageSize: CUSTOMER_CERT_LIMIT }, signal), [orgId, customerId]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<CertificateView | null>(null);
  const busyRef = useRef(false);

  // In lại: lấy URL ảnh MỚI của đúng giấy này (URL ký chỉ sống 10 phút) rồi mở bản in. Chữ và ảnh vẫn là bản chụp lúc cấp.
  async function reprint(c: CertificateView) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(c.id);
    setPrintError(null);
    try {
      const res = await listCertificates(orgId, { ids: [c.id], pageSize: 1 });
      const fresh = res.items.find((x) => x.id === c.id);
      if (!fresh || fresh.status !== 'ISSUED') {
        setPrintError(`Giấy ${c.code} không còn hiệu lực (đã thu hồi hoặc cấp lại), không in được. Đã tải lại danh sách.`);
        load.reload();
        return;
      }
      setSheet(fresh);
    } catch (err) {
      setPrintError(`Chưa lấy được giấy để in: ${userMessage(err)}`);
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }

  const title = 'Giấy chứng nhận';
  // Chưa biết học viên có giấy hay không: không dựng gì (thẻ ẩn nếu không có giấy nào — tránh nháy thẻ rồi biến mất).
  if (load.state.status === 'loading') return null;
  if (load.state.status === 'error') {
    return (
      <Card title={title} aria-label="Giấy chứng nhận của học viên" className="kc-card">
        <LoadErrorStrip error={load.state.error} retry={load.reload} />
      </Card>
    );
  }

  const { items, total } = load.state.data;
  if (items.length === 0) return null;

  return (
    <>
      <Card
        title={title}
        aria-label="Giấy chứng nhận của học viên"
        className="kc-card"
        flush
        actions={<span className="kc-count">{`${total} giấy`}</span>}
        footer={
          <Link className="kc-all" to={certificateRegisterPath(slug, customerId)}>
            Xem trong sổ
          </Link>
        }
      >
        {printError && (
          <div className="kc-err" role="alert">
            {printError}
          </div>
        )}
        <ul className="kc-list">
          {items.map((c) => {
            const st = certificateStatus(c);
            const revoked = c.status === 'REVOKED';
            return (
              <li key={c.id} className={revoked ? 'kc-row is-revoked' : 'kc-row'}>
                <div className="kc-main">
                  <span className="kc-title">{certificateTitle(c)}</span>
                  <span className="kc-sub">{certificateSub(c)}</span>
                  <span className="kc-st">
                    <StatusTag tone={st.tone} title={revoked && c.revokeReason ? `Lý do: ${c.revokeReason}` : undefined}>
                      {st.label}
                    </StatusTag>
                  </span>
                  {revoked && c.revokeReason && <span className="kc-why">{`Lý do: ${c.revokeReason}`}</span>}
                </div>
                {!revoked && (
                  <Button size="sm" icon={<PrintIcon />} loading={busyId === c.id} disabled={busyId !== null} aria-label={`In lại ${c.code}`} onClick={() => void reprint(c)}>
                    In lại
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {sheet && (
        <Dialog
          open
          onClose={() => setSheet(null)}
          className="kc-dlg"
          eyebrow={certificateTitle(sheet)}
          title={`In lại giấy chứng nhận ${sheet.code}`}
          footer={
            <Button variant="primary" onClick={() => setSheet(null)}>
              Xong
            </Button>
          }
        >
          <div className="kc-print">
            <Suspense
              fallback={
                <div role="status" aria-label="Đang mở bản in" className="kc-loading">
                  <Skeleton width="50%" height={14} />
                </div>
              }
            >
              <PrintSheet orgId={orgId} items={[sheet]} {...certificatePrintNames(sheet)} breakpoint={bp} renderDeps={renderDeps} />
            </Suspense>
          </div>
        </Dialog>
      )}
    </>
  );
}
