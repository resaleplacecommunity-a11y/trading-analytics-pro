import AnalyticsHub from './pages/AnalyticsHub';
import ApiSettings from './pages/ApiSettings';
import BehaviorAnalysis from './pages/BehaviorAnalysis';
import Dashboard from './pages/Dashboard';
import Focus from './pages/Focus';
import Home from './pages/Home';
import InProcess from './pages/InProcess';
import MarketOutlook from './pages/MarketOutlook';
import Notes from './pages/Notes';
import RiskManager from './pages/RiskManager';
import Trades from './pages/Trades';
import Settings from './pages/Settings';
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
    "Notes": Notes,
    "RiskManager": RiskManager,
    "Trades": Trades,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};