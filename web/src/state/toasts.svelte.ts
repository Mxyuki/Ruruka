export type ToastKind = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

const displayMs: Record<ToastKind, number> = { info: 4000, success: 4000, error: 7000 };
const actionDisplayMs = 12000;

class Toasts {
  items = $state<Toast[]>([]);
  private nextId = 1;

  show(message: string, kind: ToastKind = 'info', action?: ToastAction): void {
    const id = this.nextId++;
    this.items.push({ id, kind, message, action });
    setTimeout(() => this.dismiss(id), action ? actionDisplayMs : displayMs[kind]);
  }

  success(message: string, action?: ToastAction): void {
    this.show(message, 'success', action);
  }

  error(error: unknown, context?: string): void {
    const detail = error instanceof Error ? error.message : String(error);
    this.show(context ? `${context}: ${detail}` : detail, 'error');
  }

  dismiss(id: number): void {
    this.items = this.items.filter((toast) => toast.id !== id);
  }
}

export const toasts = new Toasts();
