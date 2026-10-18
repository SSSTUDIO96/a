// "Mức dùng so với gói" (bản vẽ C2 mục 5.4 thẻ 3): Thành viên, Lịch tháng này, Dung lượng.
// Giới hạn null → "x / Không giới hạn", không vẽ thanh. ≥ 90% → thanh đỏ. Học viên, Khoá học KHÔNG vẽ (máy chủ trả null =
// chưa đếm được).
import type { OrgDetail } from '../../api/platform';
import { Card } from '../../ui';
import { fmtInt, fmtMb, UNLIMITED } from './labels';

interface UsageLine {
  key: string;
  label: string;
  used: number;
  limit: number | null;
  show: (n: number) => string;
}

export function usageLines(d: OrgDetail): UsageLine[] {
  const plan = d.effectivePlan?.plan;
  return [
    { key: 'staff', label: 'Thành viên', used: d.usage.staff, limit: plan ? plan.maxStaff : null, show: fmtInt },
    { key: 'appointments', label: 'Lịch tháng này', used: d.usage.appointmentsThisMonth, limit: plan ? plan.maxAppointmentsPerMonth : null, show: fmtInt },
    { key: 'storage', label: 'Dung lượng', used: d.usage.storageMb, limit: plan ? plan.maxStorageMb : null, show: fmtMb },
  ];
}

export function UsageBars({ detail }: { detail: OrgDetail }) {
  const known = detail.effectivePlan !== null;
  return (
    <Card title="Mức dùng so với gói">
      {usageLines(detail).map((l) => {
        const pct = l.limit === null ? null : l.limit === 0 ? (l.used > 0 ? 100 : 0) : Math.min(100, (l.used / l.limit) * 100);
        const limitText = !known ? 'chưa rõ giới hạn' : l.limit === null ? UNLIMITED : l.show(l.limit);
        return (
          <div key={l.key} className="pf-us" data-testid={`muc-dung-${l.key}`}>
            <span className="pf-us__l">{l.label}</span>
            {pct === null ? (
              <span className="pf-us__bar pf-us__bar--none" aria-hidden="true" />
            ) : (
              <span
                className="pf-us__bar"
                role="meter"
                aria-label={l.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
              >
                <i className={pct >= 90 ? 'hi' : undefined} style={{ width: `${pct}%` }} />
              </span>
            )}
            <span className="pf-us__v num">
              {l.show(l.used)} / {limitText}
            </span>
          </div>
        );
      })}
    </Card>
  );
}
