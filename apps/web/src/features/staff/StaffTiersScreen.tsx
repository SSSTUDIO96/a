import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { userMessage } from '../../api/errors';
import type { MemberView } from '../../api/org';
import { listStaff, updateStaff } from '../../api/staff';
import type { StaffMember } from '../../api/types';
import { PageHeader } from '../../layout/PageHeader';
import { useBreakpoint } from '../../layout/useBreakpoint';
import { Button, EmptyState, IconBack, IconPlus, ListDetail } from '../../ui';
import { AddStaffDialog } from './AddStaffDialog';
import { ALL_GROUP, groupStaff, groupTitle, roleNames, tierLockReason, type StaffPerms } from './logic';
import { LoadErrorStrip, SearchBox, Strip } from './parts';
import { StaffList, type UndoNotice } from './StaffList';
import { StaffProfileDialog } from './StaffProfileDialog';
import { TierList } from './TierList';
import { TierManagerDialog } from './TierManagerDialog';
import { type OrgInfo } from './useOrgInfo';
import { useStaffData } from './useStaff';
import { StaffSegmented } from './StaffSegmented';

// Màn "Thợ & bậc lương" (C2 1.2): ListDetail hẹp — trái: bậc lương; phải: thợ của nhóm đang chọn.
// Đường: /nhan-su (tất cả) · /nhan-su/bac/:tierId (tierId = 'chua-gan' | 'tat-ca' | id bậc).
const UNDO_MS = 6000;
const SEARCH_DELAY_MS = 300;

export function StaffTiersScreen({ org, perms }: { org: OrgInfo; perms: StaffPerms }) {
  const { tierId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const bp = useBreakpoint();
  const phone = bp === 'phone';
  const data = useStaffData(org.orgId, perms.rolesRead);
  const group = tierId ?? ALL_GROUP;

  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; ids: Set<string> } | null>(null);
  const [searchError, setSearchError] = useState<unknown>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<UndoNotice | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StaffMember | null>(null);
  const [tiersDlg, setTiersDlg] = useState<{ open: boolean; focusNew: boolean }>(() => ({
    open: Boolean((location.state as { openTiers?: boolean } | null)?.openTiers) && perms.write,
    focusNew: true,
  }));
  const [addOpen, setAddOpen] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  // Tìm: đợi 300 ms sau lần gõ cuối rồi hỏi máy chủ (máy chủ tìm cả số điện thoại khi người xem có staff.write).
  useEffect(() => {
    const text = q.trim();
    if (!text) {
      setFound(null);
      setSearchError(null);
      return undefined;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      listStaff(org.orgId, { q: text }, controller.signal)
        .then((r) => {
          setFound({ q: text, ids: new Set(r.items.map((s) => s.membershipId)) });
          setSearchError(null);
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setSearchError(err);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q, org.orgId, searchAttempt]);

  const ready = data.state.status === 'ready' ? data.state.data : null;
  const title = ready ? groupTitle(group, ready.tiers) : null;
  const rows = useMemo(() => {
    if (!ready) return null;
    const list = groupStaff(ready.staff, group);
    // Điện thoại: kết quả tìm hiện ở màn danh sách bậc; màn con của một bậc không lọc theo ô tìm (ô tìm không hiện ở đó).
    if (!found || !q.trim() || phone) return list;
    return list.filter((s) => found.ids.has(s.membershipId));
  }, [ready, group, found, q, phone]);

  function showUndo(n: UndoNotice | null) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setNotice(n);
    if (n) undoTimer.current = setTimeout(() => setNotice(null), UNDO_MS);
  }

  async function changeTier(row: StaffMember, nextTierId: string | null, isUndo = false) {
    const prevTierId = row.tier?.id ?? null;
    if (prevTierId === nextTierId) return;
    setSavingId(row.membershipId);
    setRowErrors((e) => ({ ...e, [row.membershipId]: '' }));
    try {
      const updated = await updateStaff(org.orgId, row.membershipId, { tierId: nextTierId });
      data.replaceStaff(updated);
      void data.refreshTiers().catch(() => undefined);
      if (isUndo) showUndo(null);
      else {
        const to = updated.tier?.name ?? 'Không có bậc';
        showUndo({
          membershipId: row.membershipId,
          text: `Đã chuyển ${updated.displayName} sang ${to}`,
          undo: () => void changeTier(updated, prevTierId, true),
        });
      }
    } catch (err) {
      // Ô chọn đọc bậc từ dữ liệu máy chủ → lỗi thì tự quay về bậc cũ; dải đỏ dưới dòng là lời máy chủ.
      setRowErrors((e) => ({ ...e, [row.membershipId]: userMessage(err) }));
      if (isUndo) showUndo(null);
    } finally {
      setSavingId(null);
    }
  }

  function onAdded(m: MemberView) {
    setAddOpen(false);
    setHighlightId(m.id);
    setInfo(`Đã thêm ${m.user.fullName}. Mở “Hồ sơ” để gán bậc lương.`);
    data.reload();
    navigate(phone ? `/${org.slug}/nhan-su/bac/${ALL_GROUP}` : `/${org.slug}/nhan-su`);
  }

  const addButton = perms.invite ? (
    <Button variant="primary" icon={<IconPlus />} onClick={() => setAddOpen(true)}>
      Thêm thợ
    </Button>
  ) : undefined;
  const phoneAdd = perms.invite ? <Button variant="primary" size="sm" icon={<IconPlus />} aria-label="Thêm thợ" onClick={() => setAddOpen(true)} /> : undefined;
  const isChild = tierId !== undefined;

  const searchBox = (
    <SearchBox
      className={phone ? 'st-search--list' : 'st-search--head'}
      size={phone ? 'md' : 'sm'}
      value={q}
      onChange={setQ}
      placeholder="Tìm theo tên"
      label="Tìm thợ theo tên"
    />
  );

  let detail;
  if (data.state.status === 'error') {
    detail = <LoadErrorStrip error={data.state.error} retry={data.reload} />;
  } else if (ready && title === null) {
    detail = (
      <EmptyState
        message="Không tìm thấy bậc lương này — có thể đã bị xoá ở máy khác."
        action={
          <Button icon={<IconBack />} onClick={() => navigate(`/${org.slug}/nhan-su`)}>
            Về danh sách
          </Button>
        }
      />
    );
  } else {
    detail = (
      <StaffList
        title={title ?? 'Tất cả thợ'}
        rows={rows}
        tiers={ready?.tiers ?? []}
        roles={ready?.roles ?? null}
        perms={perms}
        me={{ membershipId: org.membershipId, roleKeys: org.roleKeys }}
        search={phone ? undefined : searchBox}
        query={found && q.trim() ? q.trim() : ''}
        savingId={savingId}
        rowErrors={rowErrors}
        highlightId={highlightId}
        notice={notice}
        info={
          <>
            {searchError ? <LoadErrorStrip error={searchError} retry={() => setSearchAttempt((n) => n + 1)} /> : null}
            {info ? (
              <Strip tone="grey" action={<Button size="sm" variant="ghost" onClick={() => setInfo(null)}>Đóng</Button>}>
                {info}
              </Strip>
            ) : null}
          </>
        }
        onTierChange={(row, t) => void changeTier(row, t)}
        onOpenProfile={setProfile}
      />
    );
  }

  // Điện thoại: đang tìm thì kết quả hiện ngay dưới ô tìm ở màn danh sách bậc.
  const phoneResults =
    phone && !isChild && q.trim() && ready ? (
      <StaffList
        title="Kết quả"
        rows={found ? ready.staff.filter((s) => found.ids.has(s.membershipId)) : null}
        tiers={ready.tiers}
        roles={ready.roles}
        perms={perms}
        me={{ membershipId: org.membershipId, roleKeys: org.roleKeys }}
        query={q.trim()}
        savingId={savingId}
        rowErrors={rowErrors}
        highlightId={highlightId}
        notice={notice}
        onTierChange={(row, t) => void changeTier(row, t)}
        onOpenProfile={setProfile}
      />
    ) : null;

  return (
    <>
      <PageHeader
        title={phone && isChild ? (title ?? 'Thợ & bậc lương') : 'Thợ & bậc lương'}
        backTo={phone && isChild ? `/${org.slug}/nhan-su` : undefined}
        actions={addButton}
        phoneAction={phoneAdd}
      />
      {phone && !isChild && <StaffSegmented slug={org.slug} active="tho" payrollRead={perms.payrollRead} />}
      <ListDetail
        variant="narrow"
        mobileView={isChild ? 'detail' : 'list'}
        listLabel="Bậc lương"
        detailLabel="Danh sách thợ"
        list={
          <>
            {phone && data.state.status === 'error' && <LoadErrorStrip error={data.state.error} retry={data.reload} />}
            <TierList
              slug={org.slug}
              tiers={ready?.tiers ?? null}
              staff={ready?.staff ?? null}
              selected={phone ? null : group}
              phone={phone}
              canWrite={perms.write}
              onEditTiers={() => setTiersDlg({ open: true, focusNew: false })}
              onAddTier={() => setTiersDlg({ open: true, focusNew: true })}
              search={phone ? <div className="st-search-wrap">{searchBox}</div> : undefined}
            />
            {phoneResults}
          </>
        }
        detail={detail}
      />
      {ready && (
        <StaffProfileDialog
          orgId={org.orgId}
          row={profile}
          tiers={ready.tiers}
          roleText={profile ? roleNames(profile.roleKeys, ready.roles) : ''}
          phone={phone}
          canWrite={perms.write}
          canFiles={perms.files}
          canSeeTier={perms.changeTier}
          tierLock={profile ? tierLockReason(perms, profile, { membershipId: org.membershipId, roleKeys: org.roleKeys }) : null}
          onClose={() => setProfile(null)}
          onSaved={(row) => {
            data.replaceStaff(row);
            setProfile(null);
            void data.refreshTiers().catch(() => undefined);
          }}
        />
      )}
      {ready && (
        <TierManagerDialog
          orgId={org.orgId}
          open={tiersDlg.open}
          focusNew={tiersDlg.focusNew}
          phone={phone}
          tiers={ready.tiers}
          onClose={() => setTiersDlg({ open: false, focusNew: false })}
          onChanged={data.reload}
        />
      )}
      <AddStaffDialog orgId={org.orgId} open={addOpen} phone={phone} roles={ready?.roles ?? null} onClose={() => setAddOpen(false)} onAdded={onAdded} />
    </>
  );
}
