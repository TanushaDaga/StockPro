import numpy as np
import pandas as pd

def compute_metrics(df):
    returns = df['Close'].pct_change().dropna()

    total_return = (df['Close'].iloc[-1] / df['Close'].iloc[0] - 1) * 100
    annual_return = returns.mean() * 252 * 100
    annual_vol = returns.std() * np.sqrt(252) * 100
    sharpe = annual_return / annual_vol if annual_vol != 0 else 0

    cumulative = (1 + returns).cumprod()
    peak = cumulative.cummax()
    drawdown = (cumulative - peak) / peak
    max_dd = drawdown.min() * 100

    return {
        "total_return": round(total_return,2),
        "annual_return": round(annual_return,2),
        "annual_vol": round(annual_vol,2),
        "sharpe": round(sharpe,2),
        "max_dd": round(max_dd,2),
        "start_price": round(df['Close'].iloc[0],2),
        "end_price": round(df['Close'].iloc[-1],2),
        "days": len(df)
    }


COMPANY_TO_TICKER = {
    "apple": "AAPL", "microsoft": "MSFT", "tesla": "TSLA", "amazon": "AMZN",
    "google": "GOOGL", "nvidia": "NVDA", "meta": "META", "netflix": "NFLX",
    "amd": "AMD", "intel": "INTC", "coca cola": "KO", "pepsi": "PEP",
    "jp morgan": "JPM", "goldman sachs": "GS", "boeing": "BA", "general electric": "GE"
}

SECTORS = {
    "Technology": ["AAPL", "MSFT", "NVDA", "AMD", "GOOGL", "META"],
    "Finance": ["JPM", "BAC", "WFC", "GS", "MS", "V"],
    "Healthcare": ["JNJ", "PFE", "UNH", "LLY", "MRK"],
    "Consumer": ["AMZN", "TSLA", "HD", "MCD", "NKE", "KO"],
    "Industrial": ["BA", "GE", "CAT", "MMM", "UNP"],
    "Energy": ["XOM", "CVX", "SLB", "EOG"]
}