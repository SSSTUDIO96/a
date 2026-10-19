import { useEffect, useMemo, useState } from 'react';
import { addContractLine } from '../../api/contracts';
import { fieldErrors, userMessage } from '../../api/errors';
import { newIdempotencyKey } from '../../api/idempotency';
import { useQuote } from '../../api/useQuote';
import type { ContractBody, ServicePackage } from '../../api/types';
import { Button, Dialog } from '../../ui';
import {
  dateOf,
  errorLineOf,
  lineInput,
  matchQuote,
  missingTimeLabel,
  missingTimeOf,
  missingTimeWhat,
  newPackageLine,
  quotePlan,
  serverWarnings,
  displayWarnings,
  validateDraft,
  viewsByDraft,
  weekdayShort,
  zonedIso,
  type ContractDraft,
  type ContractDetail,
  type PlacedDraft,
  type ContractQuote,
} from './model';
import { PackageLineCard } from './PackageLineCard';
import { StaffPicker } from './StaffPicker';
import { staffNaming, type StaffRosterEntry } from '../../ui/staffName';
import type { StaffPerson } from './StaffRow';
import type { ContractCatalog } from './useContractCatalog';

// Thêm MỘT gói phát sinh vào hợp đồng đã xác nhận (bản vẽ 4.3: POST /contracts/:id/lines kèm addons/travel).
// Số tiền xem trước lấy từ quote của riêng dòng đó; có thợ + giờ thì máy chủ lên lịch ngay khi thêm.
export interface ExtraPackageDialogProps {
  pkg: ServicePackage | null;
  orgId: string;
  tz: string;
  detail: ContractDetail;
  catalog: ContractCatalog;
  canPickStaff: boolean;
  // R2/R4: sổ thợ của màn hợp đồng (danh sách thợ của tổ chức ∪ thợ của các dòng) — tên ngắn + màu như hàng thợ khác.
  staffRoster: StaffRosterEntry[];
  phone: boolean;
  onClose: () => void;
  onAdded: (d: ContractDetail) => void;
}

export function ExtraPackageDialog(p: ExtraPackageDialogProps) {
  const { pkg, catalog, detail, tz } = p;
  const [line, setLine] = useState<PlacedDraft | null>(null);
  const [people, setPeople] = useState<StaffPerson[]>([]);
  // Tên hiển thị + họ tên của thợ đã chọn (từ ô chọn thợ) → tên ngắn theo hàm chung staffShortName.
  const personOf = (id: string) => {
    const x = people.find((q) => q.membershipId === id);
    return { displayName: x?.displayName ?? '', fullName: x?.fullName };
  };
  // L3: ảnh của thợ đã chọn mang đủ chữ tắt + ảnh từ ô chọn thợ, như ở màn lập hợp đồng.
  const avatarOf = (id: string) => {
    const x = people.find((q) => q.membershipId === id);
    return { initials: x?.initials, avatarUrl: x?.avatarUrl ?? null };
  };
  const naming = useMemo(() => staffNaming([...p.staffRoster, ...people]), [p.staffRoster, people]);
  const [picking, setPicking] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<{ fields: Record<string, string>; message: string | null }>({ fields: {}, message: null });
  const eventDate = detail.eventDate ? dateOf(detail.eventDate, tz) : '';

  useEffect(() => {
    if (!pkg) return;
    const studio = catalog.studios.find((s) => s.isDefault) ?? catalog.studios[0] ?? null;
    setLine(newPackageLine(pkg, studio?.id ?? null, catalog.policy.defaultMode));
    setPeople([]);
    setShowErrors(false);
    setSaveError({ fields: {}, message: null });
  }, [pkg, catalog]);

  const draft: ContractDraft = useMemo(
    () => ({ customer: { kind: 'existing', id: detail.customer.id, fullName: '', phone: null, email: null }, eventDate, discount: 0, depositRequired: null, notes: '', lines: line ? [line] : [] }),
    [detail.customer.id, eventDate, line],
  );
  const local = useMemo(
    () => validateDraft(draft, { includedKmOf: () => pkg?.includedKm ?? catalog.policy.freeKm }),
    [draft, pkg, catalog.policy.freeKm],
  );
  // M5: lỗi chỉ về giờ (có giờ bắt đầu, chưa có giờ kết thúc…) không chặn xem giá — dòng được tính không kèm giờ/thợ.
  const plan = quotePlan(draft, local);
  const quoteDraft = line && plan.complete ? plan.draft : null;
  const body: ContractBody | null = quoteDraft
    ? { customerId: detail.customer.id, lines: quoteDraft.lines.map((l) => lineInput(l, eventDate, tz)) }
    : null;
  const quote = useQuote(pkg ? p.orgId : null, body);
  const view = quoteDraft ? (viewsByDraft(plan, matchQuote(quoteDraft, quote.data as ContractQuote | null))[0] ?? null) : null;
  if (!pkg || !line) return null;

  // Dòng phát sinh của hợp đồng đã chốt được lên lịch ngay: thiếu giờ thì máy chủ chặn (409 LINES_MISSING_TIME) — chặn
  // trước ở đây: lời ngắn dưới ô giờ (ô hẹp), lý do ở lời lỗi của dòng. Không đưa vào `local` vì quote xem giá vẫn chạy
  // khi chưa có giờ.
  const timeErrors: Record<string, string> = {
    ...(line.start ? {} : { 'lines.0.scheduledStart': 'Nhập giờ bắt đầu.' }),
    ...(line.end ? {} : { 'lines.0.scheduledEnd': 'Nhập giờ kết thúc.' }),
  };
  const errors = { ...(showErrors ? { ...timeErrors, ...local } : {}), ...quote.fieldErrors, ...saveError.fields };
  const subjectName = (id: string | null) => catalog.subjects.find((s) => s.id === id)?.name ?? null;
  // Dòng phát sinh của hợp đồng ĐÃ xác nhận: KHÔNG gửi excludeContractId — lịch đã có của chính hợp đồng vẫn phải tính trùng.
  const warnings = displayWarnings(serverWarnings(view?.staffWarnings), tz).filter((w) =>
    line.staff.some((s) => s.membershipId === w.membershipId),
  );

  async function add() {
    if (!line) return;
    setShowErrors(true);
    if (Object.keys(local).length > 0 || !line.start || !line.end) return;
    setBusy(true);
    try {
      const d = await addContractLine(p.orgId, detail.id, lineInput(line, eventDate, tz), newIdempotencyKey());
      p.onAdded(d as ContractDetail);
    } catch (err) {
      // 409 LINES_MISSING_TIME: máy chủ quay lui dòng vừa thêm vì thiếu giờ → đánh dấu đúng ô giờ của dòng đang thêm.
      const miss = missingTimeOf(err);
      if (miss) {
        const fields: Record<string, string> = {};
        for (const f of new Set(miss.lines.flatMap((l) => l.missing))) {
          fields[`lines.0.${f}`] = `Nhập ${missingTimeWhat([f])}.`;
        }
        setSaveError({ fields, message: `Chưa thêm được: ${miss.lines.map(missingTimeLabel).join('; ')}. Dòng phát sinh phải có giờ để lên lịch — nhập giờ rồi thêm lại.` });
        return;
      }
      // Thân gửi là MỘT dòng: đường dẫn lỗi không có tiền tố "lines.0." — thêm vào để hiện đúng ô của thẻ.
      const fields = Object.fromEntries(Object.entries(fieldErrors(err)).map(([k, v]) => [`lines.0.${k}`, v]));
      setSaveError({ fields, message: Object.keys(fields).length > 0 && errorLineOf(err) === null ? null : userMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const pickBlocked = !eventDate
    ? 'Hợp đồng chưa có ngày sự kiện.'
    : !line.start || !line.end
      ? 'Nhập giờ trước.'
      : null;

  return (
    <>
      <Dialog
        open
        onClose={p.onClose}
        eyebrow="Thêm phát sinh"
        title={pkg.name}
        footer={
          <>
            <Button onClick={p.onClose}>Huỷ</Button>
            <Button variant="primary" loading={busy} onClick={() => void add()}>
              Thêm phát sinh
            </Button>
          </>
        }
      >
        <div style={{ padding: '8px 0' }}>
          <PackageLineCard
            index={0}
            line={line}
            pkg={pkg}
            subjects={catalog.subjects}
            studios={catalog.studios}
            policy={catalog.policy}
            view={view}
            pending={quote.loading}
            locked={false}
            errors={errors}
            lineError={
              saveError.message ??
              (showErrors && Object.keys(timeErrors).length > 0 ? 'Dòng phát sinh phải có giờ bắt đầu và giờ kết thúc để lên lịch.' : null) ??
              (quote.errorLine === 0 ? userMessage(quote.error) : null)
            }
            warnings={warnings}
            people={line.staff.map((s) => ({ ...s, ...personOf(s.membershipId), ...avatarOf(s.membershipId) }))}
            personOf={personOf}
            naming={naming}
            onChange={(patch) => {
              setLine({ ...line, ...patch });
              if ('start' in patch || 'end' in patch) setSaveError({ fields: {}, message: null });
            }}
            onRemove={p.onClose}
            onPickStaff={() => setPicking(true)}
            canPickStaff={p.canPickStaff}
            pickBlockedReason={pickBlocked}
            scheduleHref={null}
            onVoid={null}
          />
        </div>
      </Dialog>
      <StaffPicker
        open={picking}
        onClose={() => setPicking(false)}
        orgId={p.orgId}
        tz={tz}
        phone={p.phone}
        query={eventDate && line.start && line.end ? { startsAt: zonedIso(eventDate, line.start, tz), endsAt: zonedIso(eventDate, line.end, tz) } : null}
        initial={line.staff}
        subtitle={`${subjectName(line.subjectId) ?? line.name} · ${line.start} – ${line.end} · ${weekdayShort(eventDate)}`}
        localConflicts={new Map()}
        naming={naming}
        onConfirm={(staff, ppl) => {
          setLine({ ...line, staff });
          setPeople(ppl);
          setPicking(false);
        }}
      />
    </>
  );
}
