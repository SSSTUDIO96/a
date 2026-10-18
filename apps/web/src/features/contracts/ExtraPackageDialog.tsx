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
  newPackageLine,
  serverWarnings,
  mergeWarnings,
  validateDraft,
  weekdayShort,
  zonedIso,
  type ContractDraft,
  type ContractDetail,
  type PlacedDraft,
  type ContractQuote,
} from './model';
import { PackageLineCard } from './PackageLineCard';
import { StaffPicker } from './StaffPicker';
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
  phone: boolean;
  onClose: () => void;
  onAdded: (d: ContractDetail) => void;
}

export function ExtraPackageDialog(p: ExtraPackageDialogProps) {
  const { pkg, catalog, detail, tz } = p;
  const [line, setLine] = useState<PlacedDraft | null>(null);
  const [people, setPeople] = useState<StaffPerson[]>([]);
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
  const body: ContractBody | null =
    line && Object.keys(local).length === 0 ? { customerId: detail.customer.id, lines: [lineInput(line, eventDate, tz)] } : null;
  const quote = useQuote(pkg ? p.orgId : null, body);
  const view = body ? (matchQuote(draft, quote.data as ContractQuote | null)[0] ?? null) : null;
  if (!pkg || !line) return null;

  const errors = { ...(showErrors ? local : {}), ...quote.fieldErrors, ...saveError.fields };
  const subjectName = (id: string | null) => catalog.subjects.find((s) => s.id === id)?.name ?? null;
  const warnings = mergeWarnings(serverWarnings(view?.staffWarnings, null), [], tz).filter((w) =>
    line.staff.some((s) => s.membershipId === w.membershipId),
  );

  async function add() {
    if (!line) return;
    setShowErrors(true);
    if (Object.keys(local).length > 0) return;
    setBusy(true);
    try {
      const d = await addContractLine(p.orgId, detail.id, lineInput(line, eventDate, tz), newIdempotencyKey());
      p.onAdded(d as ContractDetail);
    } catch (err) {
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
            lineError={saveError.message ?? (quote.errorLine === 0 ? userMessage(quote.error) : null)}
            warnings={warnings}
            people={line.staff.map((s) => ({ ...s, displayName: people.find((x) => x.membershipId === s.membershipId)?.displayName ?? '' }))}
            nameOf={(id) => people.find((x) => x.membershipId === id)?.displayName ?? ''}
            onChange={(patch) => setLine({ ...line, ...patch })}
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
        onConfirm={(staff, ppl) => {
          setLine({ ...line, staff });
          setPeople(ppl);
          setPicking(false);
        }}
      />
    </>
  );
}
