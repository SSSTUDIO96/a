import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Permission } from '@makeup/shared';
import { getContract } from '../../api/contracts';
import type { ContractDetail, ContractKind } from '../../api/types';
import { Card, SkeletonText } from '../../ui';
import { PageHeader } from '../../layout/PageHeader';
import { ContractEditor } from './ContractEditor';
import { CourseContractEditor } from './CourseContractEditor';
import { kindFromParam } from './courseModel';
import { KindSwitch } from './KindSwitch';

// Chọn màn theo LOẠI hợp đồng (bản vẽ C3 mục 2.3): Khoá học → CourseContractEditor; Dịch vụ makeup → ContractEditor đã có.
// - Lập mới: tổ chức đào tạo (ACADEMY) thấy seg loại; loại nằm trên đường dẫn (?kind=COURSE|SERVICE). Tổ chức khác: luôn dịch vụ.
// - Hợp đồng đã lưu: loại lấy từ máy chủ (kind), seg khoá — không đổi loại được sau khi lưu.
export interface ContractKindRouterProps {
  orgId: string;
  slug: string;
  tz: string;
  orgName: string;
  academy: boolean;
  has: (p: Permission) => boolean;
  contractId: string | null;
}

// createdHere: tạo ở chính màn này — giữ nguyên phiên bản màn (không dựng lại) khi đường đổi từ "moi" sang id.
type Known = { id: string; kind: ContractKind; detail: ContractDetail | null; createdHere: number | null };

export function ContractKindRouter({ orgId, slug, tz, orgName, academy, has, contractId }: ContractKindRouterProps) {
  const [params, setParams] = useSearchParams();
  // Hợp đồng vừa tạo ở màn này / đã tải: biết loại, không tải lại (đổi "moi" → id giữ nguyên dữ liệu đang nhập).
  const [known, setKnown] = useState<Known | null>(null);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  // Mỗi lần mở "Lập hợp đồng" mới là một phiên màn mới (bắt đầu trắng).
  const [session, setSession] = useState(0);
  const prevId = useRef(contractId);
  useEffect(() => {
    if (contractId === null && prevId.current !== null) setSession((n) => n + 1);
    prevId.current = contractId;
  }, [contractId]);

  useEffect(() => {
    if (!contractId || known?.id === contractId) return undefined;
    const controller = new AbortController();
    setLoadFailed(null);
    getContract(orgId, contractId, controller.signal)
      .then((d) => setKnown({ id: d.id, kind: d.kind, detail: d, createdHere: null }))
      .catch(() => {
        // Lỗi (404, mất mạng...): để màn dịch vụ tự tải và hiện đúng lỗi của nó.
        if (!controller.signal.aborted) setLoadFailed(contractId);
      });
    return () => controller.abort();
  }, [orgId, contractId, known?.id]);

  const newKind: ContractKind = academy ? (kindFromParam(params.get('kind')) ?? 'COURSE') : 'SERVICE';
  const saved = contractId !== null && known?.id === contractId ? known : null;
  const kind: ContractKind | null = contractId === null ? newKind : saved ? saved.kind : loadFailed === contractId ? 'SERVICE' : null;

  const switchKind = (k: ContractKind) => {
    const next = new URLSearchParams(params);
    next.set('kind', k);
    if (k === 'SERVICE') next.delete('classId');
    setParams(next, { replace: true });
  };
  const kindSwitch = academy && kind ? <KindSwitch value={kind} onChange={switchKind} locked={contractId !== null} /> : undefined;
  const onCreated = (d: ContractDetail) => setKnown({ id: d.id, kind: d.kind, detail: d, createdHere: session });

  if (kind === null) {
    return (
      <div className="ct-page">
        <PageHeader title="Hợp đồng" backTo={`/${slug}/hop-dong`} />
        <Card>
          <SkeletonText lines={6} widths={['40%', '80%', '60%', '75%', '50%', '65%']} label="Đang tải hợp đồng" />
        </Card>
      </div>
    );
  }
  if (kind === 'COURSE') {
    return (
      <CourseContractEditor
        key={saved ? (saved.createdHere !== null ? `moi-${saved.createdHere}` : saved.id) : `moi-${session}`}
        orgId={orgId}
        slug={slug}
        tz={tz}
        orgName={orgName}
        has={has}
        detail={saved?.detail ?? null}
        kindSwitch={kindSwitch}
        onCreated={onCreated}
      />
    );
  }
  return <ContractEditor orgId={orgId} slug={slug} tz={tz} has={has} contractId={contractId} kindSwitch={kindSwitch} onCreated={onCreated} />;
}
