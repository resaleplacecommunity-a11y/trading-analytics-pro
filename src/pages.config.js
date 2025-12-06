import Dashboard from './pages/Dashboard';
import Trades from './pages/Trades';
import DailyAnalytics from './pages/DailyAnalytics';
import WeeklyAnalytics from './pages/WeeklyAnalytics';
import RiskManager from './pages/RiskManager';
import BehaviorAnalysis from './pages/BehaviorAnalysis';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Trades": Trades,
    "DailyAnalytics": DailyAnalytics,
    "WeeklyAnalytics": WeeklyAnalytics,
    "RiskManager": RiskManager,
    "BehaviorAnalysis": BehaviorAnalysis,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};