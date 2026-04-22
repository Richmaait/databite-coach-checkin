import DashboardLayout from "@/components/DashboardLayout";

// The meal planner portal is hosted as a separate Railway service. We embed it here
// as a full-height iframe so coaches stay inside the coach app while using it.
// Allowed-to-iframe-us is enforced via CSP frame-ancestors on the portal side.
const PORTAL_URL = "https://portal-production-e449.up.railway.app/";

export default function MealPlanner() {
  return (
    <DashboardLayout>
      <div style={{ height: "100vh", width: "100%", display: "flex", flexDirection: "column" }}>
        <iframe
          src={PORTAL_URL}
          title="Databite Meal Planner"
          style={{ flex: 1, width: "100%", border: 0, display: "block" }}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </DashboardLayout>
  );
}
