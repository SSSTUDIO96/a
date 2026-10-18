// Gói cước + hạn mức (bản vẽ C2 mục 5.5, bản mẫu #b-goi): lưới thẻ repeat(auto-fill, minmax(250px, 1fr)).
// Hạn mức null = "Không giới hạn".
import { useState } from 'react';
import { userMessage } from '../../api/errors';
import { listPlans, type PlanView } from '../../api/platform';
import { Button, Card, EmptyState, formatVnd, IconPlus, Skeleton, StatusTag } from '../../ui';
import { usePlatformStats } from './context';
import { fmtLimit, fmtMb } from './labels';
import { PlanDialog } from './PlanDialog';
import { PlatformHeader } from './PlatformShell';
import { useLoad } from './useLoad';

/** 5 dòng hạn mức + tên miền riêng, đúng thứ tự trên thẻ. */
export function planLimitLines(p: PlanView): string[] {
  return [
    `Thành viên: ${fmtLimit(p.maxStaff)}`,
    `Lịch mỗi tháng: ${fmtLimit(p.maxAppointmentsPerMonth)}`,
    `Dung lượng: ${fmtMb(p.maxStorageMb)}`,
    `Học viên: ${fmtLimit(p.maxStudents)}`,
    `Khoá học: ${fmtLimit(p.maxCourses)}`,
    `Tên miền riêng: ${p.customDomain ? 'có' : 'không'}`,
  ];
}

export function PlanCard({ plan, onEdit }: { plan: PlanView; onEdit: () => void }) {
  return (
    <section className="ui-card pf-plan" aria-label={`Gói ${plan.name}`}>
      <div className="pf-plan__body">
        <div className="pf-plan__top">
          <b className="pf-plan__name">
            {plan.name} <span className="pf-fx">{plan.code}</span>
          </b>
          {plan.isActive ? <StatusTag tone="ok">Đang bán</StatusTag> : <StatusTag tone="draft">Ngừng bán</StatusTag>}
        </div>
        <div className="pf-plan__price num">
          {formatVnd(plan.priceMonthly)}
          <span className="pf-fx"> /tháng</span>
        </div>
        <ul className="pf-plan__lim">
          {planLimitLines(plan).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {plan.features.length > 0 ? (
          <div className="pf-plan__feats">
            {plan.features.map((x) => (
              <StatusTag key={x} tone="neutral">
                {x}
              </StatusTag>
            ))}
          </div>
        ) : null}
      </div>
      <footer className="pf-plan__foot">
        <Button size="sm" onClick={onEdit} aria-label={`Sửa gói ${plan.name}`}>
          Sửa
        </Button>
      </footer>
    </section>
  );
}

export function PlansPage() {
  const plans = useLoad('plans', (signal) => listPlans(signal));
  const { reloadStats } = usePlatformStats();
  const [dialog, setDialog] = useState<{ plan: PlanView | null } | null>(null);
  const addButton = (
    <Button variant="primary" icon={<IconPlus />} onClick={() => setDialog({ plan: null })}>
      Gói mới
    </Button>
  );
  const phoneAdd = (
    <Button variant="ghost" size="sm" icon={<IconPlus />} onClick={() => setDialog({ plan: null })}>
      Gói mới
    </Button>
  );

  return (
    <>
      <PlatformHeader title="Gói cước" actions={addButton} phoneAction={phoneAdd} />
      {plans.data === null ? (
        plans.error ? (
          <EmptyState message={`Không tải được gói cước. ${userMessage(plans.error)}`} action={<Button onClick={plans.reload}>Thử lại</Button>} />
        ) : (
          <div className="pf-plans" role="status" aria-label="Đang tải gói cước">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <Skeleton width="60%" height={16} />
                <div style={{ height: 10 }} />
                <Skeleton width="40%" height={20} />
                <div style={{ height: 10 }} />
                <Skeleton height={70} />
              </Card>
            ))}
          </div>
        )
      ) : plans.data.items.length === 0 ? (
        <EmptyState message="Chưa có gói cước nào." action={addButton} />
      ) : (
        <div className="pf-plans">
          {plans.data.items.map((p) => (
            <PlanCard key={p.id} plan={p} onEdit={() => setDialog({ plan: p })} />
          ))}
        </div>
      )}
      <PlanDialog
        state={dialog}
        onClose={() => setDialog(null)}
        onSaved={(_p, priceChanged) => {
          plans.reload();
          // Đổi giá làm đổi "doanh thu thuê bao dự kiến" trên trang chủ.
          if (priceChanged) reloadStats();
        }}
      />
    </>
  );
}
