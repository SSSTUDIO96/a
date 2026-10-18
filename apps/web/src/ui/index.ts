// Component dùng chung — bản vẽ C mục 3. Gói W2 sở hữu tệp này; gói khác cần thêm thì mở yêu cầu.
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { TextInput, type TextInputProps } from './TextInput';
export { Textarea, type TextareaProps } from './Textarea';
export { MoneyInput, type MoneyInputProps } from './MoneyInput';
export { UnitInput, type UnitInputProps } from './UnitInput';
export { Select, type SelectProps, type SelectOption } from './Select';
export { Checkbox, type CheckboxProps } from './Checkbox';
export { CheckChip, type CheckChipProps } from './CheckChip';
export { Switch, type SwitchProps } from './Switch';
export { Segmented, type SegmentedProps, type SegmentedOption } from './Segmented';
export { Qty, type QtyProps } from './Qty';
export { Card, type CardProps } from './Card';
export { SettingRow, type SettingRowProps } from './SettingRow';
export { Dialog, type DialogProps } from './Dialog';
export { BottomSheet, type BottomSheetProps } from './BottomSheet';
export { Tooltip, WithTooltip, useTooltip, type TooltipProps, type WithTooltipProps } from './Tooltip';
export {
  Avatar,
  AvatarStack,
  avatarColorIndex,
  initialsOf,
  type AvatarProps,
  type AvatarStackProps,
  type AvatarPerson,
  type AvatarSize,
} from './Avatar';
export {
  StatusTag,
  ContractStatusTag,
  WorkStatusTag,
  CONTRACT_STATUS_TONES,
  WORK_STATUS_TONES,
  type StatusTagProps,
  type TagTone,
} from './StatusTag';
export { Chip, type ChipProps } from './Chip';
export { StickyTotalBar, type StickyTotalBarProps } from './StickyTotalBar';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { Skeleton, SkeletonText, type SkeletonProps, type SkeletonTextProps } from './Skeleton';
export { IconPlus, IconClose, IconCheck, IconLock, IconBack } from './icons';
export {
  formatVnd,
  formatKm,
  formatDecimal,
  parseMoney,
  parseKm,
  parseDecimal,
  groupThousands,
  type ParseResult,
  type DecimalRules,
  type Vnd,
} from './format';
export { DateInput, parseVnDate, formatVnDate, type DateInputProps } from './DateInput';
export { TimeInput, parseTime, type TimeInputProps } from './TimeInput';
export { IconNext, IconWarn, IconFilter, IconCalendar, IconClock } from './icons';
// Bản vẽ C2 mục 0.1–0.2 (thợ W2b)
export { ListDetail, type ListDetailProps } from './ListDetail';
export { ListGroupHeader, type ListGroupHeaderProps } from './ListGroupHeader';
export { ListRow, ListRowSkeleton, type ListRowProps, type ListRowSkeletonProps } from './ListRow';
export { StatTile, StatGrid, type StatTileProps, type StatGridProps } from './StatTile';
export { PersonChip, PersonChipList, type PersonChipProps, type PersonChipListProps } from './PersonChip';
export {
  ImageUpload,
  checkImageFile,
  IMAGE_TYPES,
  type ImageUploadProps,
  type ImageUploadContext,
} from './ImageUpload';
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
export { IconUpload } from './icons';
