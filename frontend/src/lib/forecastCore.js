// Runs the trained demand model in the browser. Mirrors feats() in train_demand.py exactly.

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const popStd = (a) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};

// hist: daily units sold, oldest first, last item = most recent day (needs >= 28 days)
export function buildFeatures(model, hist, nextDate, category, price, stockRatio) {
  const last7 = hist.slice(-7);
  const f = [...last7, mean(hist.slice(-14)), mean(hist.slice(-28)), popStd(last7)];
  const dow = (nextDate.getUTCDay() + 6) % 7; // Monday = 0, like Python
  f.push(Math.sin((2 * Math.PI * dow) / 7), Math.cos((2 * Math.PI * dow) / 7));
  const mo = nextDate.getUTCMonth();
  f.push(Math.sin((2 * Math.PI * mo) / 12), Math.cos((2 * Math.PI * mo) / 12));
  f.push(dow >= 5 ? 1 : 0);
  for (const c of model.meta.categories) f.push(category === c ? 1 : 0);
  f.push(Math.log(Math.max(price, 1)));
  f.push(stockRatio);
  return f;
}

export function forward(model, features) {
  let x = features.map((v, i) => (v - model.xMean[i]) / model.xScale[i]);
  model.layers.forEach((layer, li) => {
    const last = li === model.layers.length - 1;
    x = layer.b.map((b, j) => {
      let s = b;
      const w = layer.W[j];
      for (let i = 0; i < x.length; i++) s += w[i] * x[i];
      return last ? s : Math.max(0, s);
    });
  });
  return x.map((v) => Math.max(0, v * model.yStd + model.yMean));
}

// Predicted units for each of the next 7 days.
export function predictWeek(model, hist, nextDate, { category, price, stock, reorder }) {
  const ratio = reorder > 0 ? Math.min(6, Math.max(0, stock / reorder)) : 0;
  return forward(model, buildFeatures(model, hist, nextDate, category, price, ratio));
}

export function dayAfter(endIso) {
  const d = new Date(endIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}
