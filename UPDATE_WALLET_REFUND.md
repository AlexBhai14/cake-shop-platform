# Update: delivered-order refund fix + Customer Wallet

## Kya badla
1. **Bug fix:** DELIVERED order par Refund ab nahi ho sakta.
   - Backend: payment-service ko `order.status_changed` (DELIVERED) event milta hai, payment par `orderDelivered=true` lagta hai. Admin refund API ab 409 deti hai.
   - Admin UI: Refund button sirf tab dikhta hai jab payment `refundable` ho (aur order DELIVERED na ho).
2. **Wallet:** refund hote hi paisa customer ke wallet me credit hota hai (usi DB transaction me, double credit nahi).
   - API: `GET /api/payments/wallet`, `GET /api/payments/wallet/transactions`
   - Customer app: naya **Wallet** page + navbar link.
   - Refund email me likha aata hai ki amount wallet me add hua.

Wallet abhi sirf refund ka paisa jama karta hai. Checkout me wallet se pay karna is update me nahi hai.

## Kaise lagana hai (PowerShell, ek ek command)
1. Zip ko project root (`D:\Sahil_Code\Project\Cake`) me extract karo, "replace files" bolo. Isse sirf changed/new files badlengi.
2. Payment service ka naya DB table banao:
   ```powershell
   cd backend\payment-service
   npx prisma migrate dev --name add_wallet_and_delivered_flag
   ```
   (Agar "reset database" puche to **No** bolo aur mujhe output bhejo.)
3. Pehle se DELIVERED ho chuke orders ke liye ek baar ka data fix (MySQL me, sirf local dev data ke liye):
   ```sql
   UPDATE cake_payment_db.payments p
   JOIN cake_order_db.orders o ON o.id = p.orderId
   SET p.orderDelivered = 1
   WHERE o.status = 'DELIVERED';
   ```
4. Tests chalao aur output mujhe bhejo:
   ```powershell
   cd backend\payment-service
   npm test
   ```
   Phir `backend\notification-service` me bhi `npm test`.
5. Services restart karo (payment-service ko naya event binding `order.status_changed` restart par milta hai).

## Known limitation
Admin "Refund" dabane aur DELIVERED event payment-service tak pahunchne ke beech kuch milliseconds ka gap ho sakta hai. Practically negligible, par agar bilkul pakka chahiye to refund order-service ke through route karna padega (alag change).
