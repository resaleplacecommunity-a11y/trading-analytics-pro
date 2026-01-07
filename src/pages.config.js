import AnalyticsHub from './pages/AnalyticsHub';
import ApiSettings from './pages/ApiSettings';
import BehaviorAnalysis from './pages/BehaviorAnalysis';
import Focus from './pages/Focus';
import Home from './pages/Home';
import InProcess from './pages/InProcess';
import MarketOutlook from './pages/MarketOutlook';
import Notes from './pages/Notes';
import RiskManager from './pages/RiskManager';
import Settings from './pages/Settings';
import Trades from './pages/Trades';
import Dashboard from './pages/Dashboard';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AnalyticsHub": AnalyticsHub,
    "ApiSettings": ApiSettings,
    "BehaviorAnalysis": BehaviorAnalysis,
    "Focus": Focus,
    "Home": Home,
    "InProcess": InProcess,
    "MarketOutlook": MarketOutlook,
    "Notes": Notes,
    "RiskManager": RiskManager,
    "Settings": Settings,
    "Trades": Trades,
    "Dashboard": Dashboard,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};