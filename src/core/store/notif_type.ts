export type NotificationType = "warn" | "info" | "critical" | "unknown";
export interface Notificatin {
    id: string;
    type: NotificationType;
    title?: string;
    message?: string;
    onClick?: () => void;
}
