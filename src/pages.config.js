import Dashboard from './pages/Dashboard';
import Trades from './pages/Trades';
import RiskManager from './pages/RiskManager';
import BehaviorAnalysis from './pages/BehaviorAnalysis';
import Settings from './pages/Settings';
import Notes from './pages/Notes';
import MarketOutlook from './pages/MarketOutlook';
import ApiSettings from './pages/ApiSettings';
import AnalyticsHub from './pages/AnalyticsHub';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Trades": Trades,
    "RiskManager": RiskManager,
    "BehaviorAnalysis": BehaviorAnalysis,
    "Settings": Settings,
    "Notes": Notes,
    "MarketOutlook": MarketOutlook,
    "ApiSettings": ApiSettings,
    "AnalyticsHub": AnalyticsHub,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};