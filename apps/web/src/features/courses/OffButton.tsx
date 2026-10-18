import { Button, useTooltip, type ButtonProps } from '../../ui';

// Nút tắt có lý do trong tooltip (rê chuột, Tab tới, hoặc chạm trên điện thoại). Không dùng thuộc tính disabled gốc
// vì nút disabled không nhận tiêu điểm và không nhận rê chuột — người dùng sẽ không đọc được lý do.
export function OffButton({ label, reason, variant, size = 'sm' }: { label: string; reason: string; variant?: ButtonProps['variant']; size?: ButtonProps['size'] }) {
  const tip = useTooltip(reason);
  return (
    <>
      <Button variant={variant} size={size} className="kc-off" aria-disabled="true" {...tip.anchorProps}>
        {label}
      </Button>
      {tip.node}
    </>
  );
}
