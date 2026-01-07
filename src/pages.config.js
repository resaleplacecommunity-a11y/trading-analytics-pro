import AnalyticsHub from './pages/AnalyticsHub';
import ApiSettings from './pages/ApiSettings';
import BehaviorAnalysis from './pages/BehaviorAnalysis';
import Dashboard from './pages/Dashboard';
import Focus from './pages/Focus';
import Home from './pages/Home';
import InProcess from './pages/InProcess';
import MarketOutlook from './pages/MarketOutlook';
import RiskManager from './pages/RiskManager';
import Settings from './pages/Settings';
import Trades from './pages/Trades';
import Notes from './pages/Notes';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AnalyticsHub": AnalyticsHub,
    "ApiSettings": ApiSettings,
    "BehaviorAnalysis": BehaviorAnalysis,
    "Dashboard": Dashboard,
    "Focus": Focus,
    "Home": Home,
    "InProcess": InProcess,
    "MarketOutlook": MarketOutlook,
    "RiskManager": RiskManager,
    "Settings": Settings,
    "Trades": Trades,
    "Notes": Notes,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};