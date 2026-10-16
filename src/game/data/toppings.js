// トッピング。mode：hold（長押しで量をかける）/ drop（揺れに合わせて落とす）。名前は i18n の topping.<id>。
export const TOPPINGS = {
  sprinkle: { icon: '✦', mode: 'hold', color: '#ff6fa8' },
  cherry: { icon: '●', mode: 'drop', color: '#e8213f' },
  sauce: { icon: '≈', mode: 'hold', color: '#5a2f1a' },
  wafer: { icon: '▮', mode: 'drop', color: '#e9b872' },
};
export const TOPPING_IDS = Object.keys(TOPPINGS);
