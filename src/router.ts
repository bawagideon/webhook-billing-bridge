export interface WebhookAlert {
  title: string;
  amount: string;
  customer: string;
  eventType: string;
  status: string;
  highlightColor: string;
}

export class EventRouter {
  public static formatAlert(event: any): WebhookAlert {
    const type = event.type || 'unknown.event';
    const obj = event.data?.object || {};
    const amount = obj.amount_total ? `$${(obj.amount_total / 100).toFixed(2)}` : '$0.00';
    const customer = obj.customer || obj.customer_email || 'Anonymous';

    let highlightColor = '#3498db'; // Default Blue
    if (type.includes('refund') || type.includes('dispute')) {
      highlightColor = '#e74c3c'; // Red for refunds/alerts
    } else if (type.includes('succeeded') || type.includes('completed')) {
      highlightColor = '#2ecc71'; // Green for revenue
    }

    return {
      title: `Stripe Event: ${type}`,
      amount,
      customer,
      eventType: type,
      status: obj.payment_status || 'received',
      highlightColor
    };
  }
}
