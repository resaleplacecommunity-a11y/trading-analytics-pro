import Dashboard from './pages/Dashboard';
import Trades from './pages/Trades';
import WeeklyAnalytics from './pages/WeeklyAnalytics';
import RiskManager from './pages/RiskManager';
import BehaviorAnalysis from './pages/BehaviorAnalysis';
import Settings from './pages/Settings';
import Notes from './pages/Notes';
import MarketOutlook from './pages/MarketOutlook';
import ApiSettings from './pages/ApiSettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Trades": Trades,
    "WeeklyAnalytics": WeeklyAnalytics,
    "RiskManager": RiskManager,
    "BehaviorAnalysis": BehaviorAnalysis,
    "Settings": Settings,
    "Notes": Notes,
    "MarketOutlook": MarketOutlook,
    "ApiSettings": ApiSettings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};