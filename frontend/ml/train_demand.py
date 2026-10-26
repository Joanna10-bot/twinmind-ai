"""Train the TwinMind demand model on SAMPLE sales history and export it for the browser.

The sales history is synthetic (generated below) because the warehouse has no real
sales records yet. Every number this script prints is a real measurement on that
synthetic data, not on real sales.
"""
import json, math, sys, datetime as dt
import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler

SEED = 42
rng = np.random.default_rng(SEED)
fixture = json.load(open("w001.json"))
meta = {p: v["product_details"] for p, v in fixture["products"].items()}
pids = sorted(meta)
CATS = ["Electronics", "Accessories", "Furniture", "Networking"]

END = dt.date(2026, 10, 25)
N_DAYS = 540
dates = [END - dt.timedelta(days=N_DAYS - 1 - i) for i in range(N_DAYS)]

# ---------- 1. sample sales history ----------
WEEK = {  # Mon..Sun multipliers per category
    "Electronics": [1.05, 1.0, 1.0, 1.0, 1.1, 1.0, 0.85],
    "Accessories": [0.9, 0.9, 0.95, 1.0, 1.1, 1.25, 1.15],
    "Furniture":   [1.1, 1.1, 1.05, 1.0, 1.0, 0.9, 0.85],
    "Networking":  [1.1, 1.05, 1.0, 1.0, 1.0, 0.95, 0.9],
}
def month_factor(m):
    return {10: 1.25, 11: 1.3, 12: 1.15, 1: 0.9, 2: 0.9, 6: 0.95, 7: 0.95}.get(m, 1.0)

demand = {}
for p in pids:
    m = meta[p]
    base = max(0.8, m["reorder_level"] * 0.18)
    trend = rng.uniform(-0.0004, 0.0008)
    d = []
    for i, day in enumerate(dates):
        lam = base * WEEK[m["category"]][day.weekday()] * month_factor(day.month) * (1 + trend * i)
        if rng.random() < 0.03:
            lam *= 1.8  # occasional promotion
        d.append(int(rng.poisson(lam)))
    demand[p] = np.array(d)

# ---------- 2. features (mirrored exactly in forecast.js) ----------
def feats(hist, nextday, category, price, stock_ratio):
    """hist: list of daily units, last element = most recent day."""
    h = np.asarray(hist, dtype=float)
    last7 = h[-7:]
    f = list(last7)
    f.append(h[-14:].mean())
    f.append(h[-28:].mean())
    f.append(last7.std())  # population std
    dow = nextday.weekday()
    f += [math.sin(2 * math.pi * dow / 7), math.cos(2 * math.pi * dow / 7)]
    mo = nextday.month - 1
    f += [math.sin(2 * math.pi * mo / 12), math.cos(2 * math.pi * mo / 12)]
    f.append(1.0 if dow >= 5 else 0.0)
    f += [1.0 if category == c else 0.0 for c in CATS]
    f.append(math.log(price))
    f.append(stock_ratio)
    return f

# simulated stock level: order up to 5x reorder level when stock hits reorder level, 3-day lead time
def simulate_stock(d, reorder):
    S = 5 * reorder
    stock, arrive, out = S, None, []
    for i, x in enumerate(d):
        if arrive is not None and i == arrive:
            stock, arrive = S, None
        out.append(stock / reorder)  # level at the START of day i
        stock = max(0, stock - x)
        if arrive is None and stock <= reorder:
            arrive = i + 3
    return out

X, Y, T, P, STK, BASE_NAIVE = [], [], [], [], [], []
for p in pids:
    d = demand[p]; m = meta[p]
    ratio = simulate_stock(d, m["reorder_level"])
    for t in range(27, N_DAYS - 7):
        X.append(feats(d[: t + 1], dates[t + 1], m["category"], m["unit_price"], ratio[t + 1] if t + 1 < N_DAYS else ratio[t]))
        Y.append(d[t + 1 : t + 8])
        T.append(t); P.append(p); STK.append(ratio[t + 1] * m["reorder_level"])
X = np.array(X); Y = np.array(Y, dtype=float); T = np.array(T); P = np.array(P); STK = np.array(STK)

lo, hi = 27, N_DAYS - 8
span = hi - lo + 1
c1 = lo + int(0.70 * span); c2 = lo + int(0.85 * span)
tr = (T < c1 - 7)
va = (T >= c1) & (T < c2 - 7)
te = (T >= c2)
print(f"samples train/val/test = {tr.sum()}/{va.sum()}/{te.sum()}")

xs = StandardScaler().fit(X[tr])
ym, ysd = Y[tr].mean(), Y[tr].std()
Xtr, Xva, Xte = xs.transform(X[tr]), xs.transform(X[va]), xs.transform(X[te])
Ytr, Yva = (Y[tr] - ym) / ysd, (Y[va] - ym) / ysd

# ---------- 3. training: MLP 64-32, Adam lr 1e-3, batch 256, <=100 epochs, patience 10, seed 42 ----------
net = MLPRegressor(hidden_layer_sizes=(64, 32), activation="relu", solver="adam",
                   learning_rate_init=0.001, batch_size=256, alpha=1e-4, random_state=SEED)
best, best_w, wait, hist = 1e9, None, 0, []
for ep in range(1, 101):
    net.partial_fit(Xtr, Ytr)
    v = float(np.mean((net.predict(Xva) - Yva) ** 2))
    hist.append(v)
    if v < best - 1e-6:
        best, wait = v, 0
        best_w = ([w.copy() for w in net.coefs_], [b.copy() for b in net.intercepts_])
    else:
        wait += 1
        if wait >= 10:
            break
net.coefs_, net.intercepts_ = best_w
print(f"stopped at epoch {ep}, best val MSE (scaled) {best:.4f}")

def predict(Xs):
    return np.maximum(0, net.predict(Xs) * ysd + ym)

# ---------- 4. evaluation on the chronological test split ----------
def metrics(y, yh):
    e = yh - y
    mae = np.abs(e).mean(); rmse = math.sqrt((e ** 2).mean())
    r2 = 1 - (e ** 2).sum() / ((y - y.mean()) ** 2).sum()
    wape = np.abs(e).sum() / y.sum()
    return dict(MAE=round(mae, 3), RMSE=round(rmse, 3), R2=round(r2, 3), WAPE=round(wape, 3))

Yte = Y[te]
mlp = predict(Xte)
last7 = X[te][:, :7]
naive = last7.copy()  # same weekday last week: horizon h -> value 7-h+... = last7 in order
ma = np.repeat(X[te][:, 7:8], 7, axis=1)  # flat 14-day moving average
rows = {}
for name, pred in [("MLP", mlp), ("Same weekday last week", naive), ("14-day moving average", ma)]:
    rows[name] = {"daily": metrics(Yte.ravel(), pred.ravel()), "weekly_total": metrics(Yte.sum(1), pred.sum(1))}
    print(name, "daily", rows[name]["daily"], "| 7-day total", rows[name]["weekly_total"])

# stock-out alert: actual 7-day demand exceeds stock on hand
stk = STK[te]
true_a = Yte.sum(1) > stk
def prf(pred_a):
    tp = int((pred_a & true_a).sum()); fp = int((pred_a & ~true_a).sum()); fn = int((~pred_a & true_a).sum()); tn = int((~pred_a & ~true_a).sum())
    pr = tp / (tp + fp) if tp + fp else 0; rc = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * pr * rc / (pr + rc) if pr + rc else 0
    return dict(accuracy=round((tp + tn) / len(true_a), 3), precision=round(pr, 3), recall=round(rc, 3), f1=round(f1, 3), tp=tp, fp=fp, fn=fn, tn=tn)
alerts = {"MLP": prf(mlp.sum(1) > stk), "Same weekday last week": prf(naive.sum(1) > stk), "14-day moving average": prf(ma.sum(1) > stk)}
print("alert positives in test:", int(true_a.sum()), "of", len(true_a))
for k, v in alerts.items(): print("alert", k, v)

# ---------- 5. export ----------
json.dump({
    "meta": {"trainedOn": "sample (synthetic) sales history", "seed": SEED, "hidden": [64, 32], "epochs": ep,
             "samples": {"train": int(tr.sum()), "val": int(va.sum()), "test": int(te.sum())}, "categories": CATS},
    "xMean": xs.mean_.tolist(), "xScale": xs.scale_.tolist(), "yMean": ym, "yStd": ysd,
    "layers": [{"W": W.T.tolist(), "b": b.tolist()} for W, b in zip(net.coefs_, net.intercepts_)],
    "metrics": {"models": rows, "alerts": alerts, "testAlertPositives": int(true_a.sum()), "testSamples": int(len(true_a))},
}, open("demandModel.json", "w"), separators=(",", ":"))

KEEP = 90
json.dump({"end": END.isoformat(), "note": "Sample (synthetic) sales history. Replace with real sales records when available.",
           "products": {p: demand[p][-KEEP:].tolist() for p in pids}}, open("salesHistory.json", "w"), separators=(",", ":"))

# parity fixture for the JS port: first product, last day
p0 = pids[0]; m0 = meta[p0]
ratio0 = 2.2
fx = feats(list(demand[p0]), END + dt.timedelta(days=1), m0["category"], m0["unit_price"], ratio0)
xin = (np.array(fx) - xs.mean_) / xs.scale_
pred0 = np.maximum(0, net.predict(xin[None, :])[0] * ysd + ym)
json.dump({"pid": p0, "ratio": ratio0, "expected": pred0.tolist(), "features": fx}, open("parity.json", "w"))
print("parity expected", np.round(pred0, 3))
