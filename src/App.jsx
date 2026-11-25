import React, { useEffect, useState } from "react";
import { useApp } from "./context/AppContext.jsx";
import { api, API_URL } from "./services/api.js";
import Layout from "./components/layout/Layout.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import StaticPage from "./pages/StaticPage.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import FindWorkstations from "./pages/FindWorkstations.jsx";
import Laboratories from "./pages/Laboratories.jsx";
import WorkstationDetail from "./pages/WorkstationDetail.jsx";
import Profile from "./pages/Profile.jsx";
import Settings from "./pages/Settings.jsx";
import AdminOverview from "./pages/admin/AdminOverview.jsx";
import AdminWorkstations from "./pages/admin/AdminWorkstations.jsx";
import AdminSoftwareInventory from "./pages/admin/AdminSoftwareInventory.jsx";
import AdminSystemHealth from "./pages/admin/AdminSystemHealth.jsx";
import AdminAlerts from "./pages/admin/AdminAlerts.jsx";
import AdminMaintenance from "./pages/admin/AdminMaintenance.jsx";
import AdminReports from "./pages/admin/AdminReports.jsx";
import AdminAccounts from "./pages/admin/AdminAccounts.jsx";
import AdminNavTabs from "./components/admin/AdminNavTabs.jsx";
import { staticPages } from "./utils/constants.js";

export default function App() {
  const {
    user,
    setUser,
    page,
    setPage,
    selectedWorkstationId,
    setSelectedWorkstationId,
    setReturnPage,
    refreshKey,
    triggerRefresh,
    setApiLatency,
    setError
  } = useApp();

  const [loadingSession, setLoadingSession] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const [studentData, setStudentData] = useState({
    labs: [],
    workstations: [],
    software: []
  });

  const [adminData, setAdminData] = useState({
    dashboard: { counts: {}, total: 0 },
    workstations: [],
    alerts: [],
    users: []
  });

  const [routeHash, setRouteHash] = useState(window.location.hash);

  // Listen for hash changes
  useEffect(() => {
    function handleHashChange() {
      setRouteHash(window.location.hash);
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Determine static page slug if any
  const match = /^#\/([a-z-]+)$/.exec(routeHash);
  const staticSlug = match
    ? staticPages[match[1]]
      ? match[1]
      : "not-found"
    : null;

  // Load session on startup
  useEffect(() => {
    async function initSession() {
      try {
        const result = await api("/api/auth/me");
        setUser(result.user);
        if (result.user) {
          const wsParam = new URLSearchParams(window.location.search).get(
            "workstation"
          );
          const defaultReturn =
            result.user.role === "admin" ? "Workstations" : "Dashboard";
          setReturnPage(defaultReturn);
          if (wsParam) {
            setSelectedWorkstationId(wsParam);
            setPage("System details");
          } else {
            setPage(defaultReturn);
          }
        }
      } catch (err) {
        // Not authenticated or server offline
      } finally {
        setLoadingSession(false);
      }
    }
    initSession();
  }, [setUser, setPage, setSelectedWorkstationId, setReturnPage]);

  // Sync workstation query parameter with URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedWorkstationId && page === "System details") {
      url.searchParams.set("workstation", selectedWorkstationId);
    } else {
      url.searchParams.delete("workstation");
    }
    window.history.replaceState(null, "", url.toString());
  }, [selectedWorkstationId, page]);

  // Load backend data whenever user, page, or refreshKey changes
  useEffect(() => {
    if (!user || staticSlug) return;

    let isMounted = true;
    async function loadData() {
      setDataLoading(true);
      setFetchError("");
      const t0 = performance.now();

      try {
        if (user.role === "admin") {
          const fetchPromises = [
            api("/api/admin/dashboard"),
            api("/api/admin/workstations"),
            api("/api/admin/alerts")
          ];
          if (page === "Accounts") {
            fetchPromises.push(api("/api/admin/users"));
          }

          const results = await Promise.all(fetchPromises);
          if (!isMounted) return;

          setApiLatency(Math.round(performance.now() - t0));
          setAdminData({
            dashboard: results[0] || {},
            workstations: results[1]?.workstations || [],
            alerts: results[2]?.alerts || [],
            users: results[3]?.users || []
          });
        } else {
          const [labRes, wsRes, softRes] = await Promise.all([
            api("/api/student/labs"),
            api("/api/student/workstations"),
            api("/api/student/software")
          ]);
          if (!isMounted) return;

          setApiLatency(Math.round(performance.now() - t0));
          setStudentData({
            labs: labRes.labs || [],
            workstations: wsRes.workstations || [],
            software: softRes.software || []
          });
        }
      } catch (err) {
        if (!isMounted) return;
        if (err.status === 401) {
          setUser(null);
          return;
        }
        setFetchError(err.message || "Failed to load data from server.");
        setError(err.message);
      } finally {
        if (isMounted) setDataLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [user, page, refreshKey, staticSlug, setUser, setApiLatency, setError]);

  // 1. Static page route
  if (staticSlug) {
    return <StaticPage slug={staticSlug} />;
  }

  // 2. Initial loading
  if (loadingSession) {
    return (
      <main className="auth-page">
        <section className="auth-panel" style={{ textAlign: "center" }}>
          <img
            className="brand-logo"
            src="/lab-logo.png"
            alt="Dynamic Lab logo"
            style={{ width: 64, margin: "0 auto 16px" }}
          />
          <h2>Loading Dynamic Lab Tracker...</h2>
        </section>
      </main>
    );
  }

  // 3. Unauthenticated -> Auth Page
  if (!user) {
    return <AuthPage />;
  }

  // 4. Fetch error state with Retry
  if (fetchError && !adminData.workstations.length && !studentData.workstations.length) {
    return (
      <Layout>
        <section className="panel">
          <div className="empty-state">
            <h3>Could not load this page</h3>
            <p>
              {fetchError} Check that the API server is running at {API_URL},
              then retry.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={triggerRefresh}
              disabled={dataLoading}
            >
              {dataLoading ? "Retrying..." : "Retry"}
            </button>
          </div>
        </section>
      </Layout>
    );
  }

  // Get active workstation list
  const currentWorkstations =
    user.role === "admin"
      ? adminData.workstations
      : studentData.workstations;

  // Extract unique labs for admin if needed
  const adminLabs = [
    ...new Map(
      adminData.workstations.map((w) => [
        w.lab,
        { name: w.lab, room: w.room || "Room not reported" }
      ])
    ).values()
  ];

  const currentLabs = user.role === "admin" ? adminLabs : studentData.labs;

  // Selected workstation object for detail view
  const selectedWorkstation = currentWorkstations.find(
    (w) => w.id === selectedWorkstationId
  );

  return (
    <Layout>
      {/* System Details Page */}
      {page === "System details" && (
        <WorkstationDetail
          workstation={selectedWorkstation}
          allWorkstations={currentWorkstations}
        />
      )}

      {/* Profile Page */}
      {page === "Profile" && <Profile />}

      {/* Settings Page */}
      {page === "Settings" && <Settings />}

      {/* Student Pages */}
      {page === "Dashboard" && (
        <StudentDashboard
          workstations={studentData.workstations}
          labs={studentData.labs}
        />
      )}

      {page === "Find a Workstation" && (
        <FindWorkstations
          workstations={currentWorkstations}
          labs={currentLabs}
        />
      )}

      {page === "Laboratories" && (
        <Laboratories
          workstations={currentWorkstations}
          labs={currentLabs}
        />
      )}

      {/* Admin Pages */}
      {user.role === "admin" && (
        <>
          {[
            "Overview",
            "Workstations",
            "Software Inventory",
            "System Health",
            "Alerts",
            "Maintenance",
            "Reports",
            "Accounts"
          ].includes(page) && <AdminNavTabs alerts={adminData.alerts} />}

          {page === "Overview" && (
            <AdminOverview
              dashboard={adminData.dashboard}
              workstations={adminData.workstations}
              alerts={adminData.alerts}
            />
          )}

          {page === "Workstations" && (
            <AdminWorkstations
              dashboard={adminData.dashboard}
              workstations={adminData.workstations}
            />
          )}

          {page === "Software Inventory" && (
            <AdminSoftwareInventory
              workstations={adminData.workstations}
            />
          )}

          {page === "System Health" && (
            <AdminSystemHealth
              workstations={adminData.workstations}
            />
          )}

          {page === "Alerts" && (
            <AdminAlerts alerts={adminData.alerts} />
          )}

          {page === "Maintenance" && (
            <AdminMaintenance
              workstations={adminData.workstations}
            />
          )}

          {page === "Reports" && (
            <AdminReports
              workstations={adminData.workstations}
            />
          )}

          {page === "Accounts" && (
            <AdminAccounts users={adminData.users} />
          )}
        </>
      )}
    </Layout>
  );
}
