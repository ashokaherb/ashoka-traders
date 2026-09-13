// Which order status can follow which (audit L3). An order only moves forward through
// fulfilment, and can be cancelled until it has shipped. Delivered and Cancelled are final.
//
//   Placed -> Packed -> Shipped -> Delivered
//      \________\______-> Cancelled
//
// Keep in sync with admin/src/pages/OrderDetail.jsx, which only offers these options.
const ORDER_STATUS_TRANSITIONS = {
  Placed: ["Packed", "Cancelled"],
  Packed: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

const canMoveOrderStatus = (from, to) => from === to || (ORDER_STATUS_TRANSITIONS[from] || []).includes(to);

module.exports = { ORDER_STATUS_TRANSITIONS, canMoveOrderStatus };
