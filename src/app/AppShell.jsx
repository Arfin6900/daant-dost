import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import Logo from "../ui/Logo";
import Avatar from "../ui/Avatar";
import NameDialog from "./NameDialog";
import { useStudent } from "../lib/student";

export const NAV = [
  { to: "/assess", label: "Practice cases" },
  { to: "/explore", label: "3D explorer" },
  { to: "/learn", label: "Drills" },
  { to: "/explain", label: "Treatments explained" },
];

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
    isActive ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
  }`;

const AppShell = () => {
  const student = useStudent();
  const [naming, setNaming] = useState(false);
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-stage/95 text-white backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5" aria-label="ToothTwin home">
            <Logo className="h-8 w-8" />
            <span className="font-display text-lg font-semibold tracking-tight">ToothTwin</span>
          </NavLink>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNaming(true)}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-bold text-white/80 hover:bg-white/5 hover:text-white"
            >
              <Avatar name={student.name || "?"} role="examiner" size="h-7 w-7 text-xs" />
              {student.name || "Set your name"}
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-white/80 hover:bg-white/10 md:hidden"
              onClick={() => setMenu((m) => !m)}
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
            >
              {menu ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="flex flex-col gap-1 border-t border-white/5 px-4 py-3 md:hidden" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={navClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line px-4 py-5 text-center text-sm text-ink-faint print:hidden">
        ToothTwin is for education. Every patient is fictional; nothing here is a diagnosis.
      </footer>
      <NameDialog open={naming} onClose={() => setNaming(false)} />
    </div>
  );
};

export default AppShell;
