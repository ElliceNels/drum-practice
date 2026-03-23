import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { label: "Record", path: "/" },
  { label: "History", path: "/history" },
];

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="bg-white shadow-sm px-6 py-3 flex items-center justify-between">
      <h1 className="text-lg font-bold text-slate-800">Drum Practice</h1>

      <div className="flex items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          );
        })}

        <span className="text-sm text-slate-400 ml-2">{user?.username}</span>

        <button
          onClick={logout}
          className="px-3 py-1.5 text-sm font-medium rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
