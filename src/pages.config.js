/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
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
import Settings from './pages/Settings';
import Trades from './pages/Trades';
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
    "Settings": Settings,
    "Trades": Trades,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};