import { createBrowserRouter, createMemoryRouter } from "react-router-dom";
import AppShell from "./AppShell";
import HomePage from "../features/home/HomePage";
import ExplorePage from "../features/explore/ExplorePage";
import AssessHub from "../features/assess/AssessHub";
import AssessmentPage from "../features/assess/AssessmentPage";
import LearnPage from "../features/learn/LearnPage";
import QuizPage from "../features/learn/QuizPage";
import ExplainPage from "../features/explain/ExplainPage";
import CheckPage from "../features/check/CheckPage";
import HistoryPage from "../features/history/HistoryPage";
import CasePage from "../features/history/CasePage";
import NotFound from "./NotFound";

export const routes = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "check", element: <CheckPage /> },
      { path: "history", element: <HistoryPage /> },
      { path: "history/:id", element: <CasePage /> },
      { path: "explore", element: <ExplorePage /> },
      { path: "assess", element: <AssessHub /> },
      { path: "assess/:id", element: <AssessmentPage /> },
      { path: "learn", element: <LearnPage /> },
      { path: "learn/:mode", element: <QuizPage /> },
      { path: "explain", element: <ExplainPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const createAppRouter = ({ initialEntries } = {}) =>
  initialEntries ? createMemoryRouter(routes, { initialEntries }) : createBrowserRouter(routes);
