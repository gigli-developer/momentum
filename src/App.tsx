import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/modules/dashboard/DashboardPage'
import { HabitsPage } from '@/modules/habits/HabitsPage'
import { RitualPage } from '@/modules/ritual/RitualPage'
import { PlannerPage } from '@/modules/planner/PlannerPage'
import { JournalPage } from '@/modules/journal/JournalPage'
import { GoalsPage } from '@/modules/goals/GoalsPage'
import { WheelPage } from '@/modules/wheel/WheelPage'
import { StatsPage } from '@/modules/stats/StatsPage'
import { MementoPage } from '@/modules/memento/MementoPage'
import { SettingsPage } from '@/modules/settings/SettingsPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/habitos" element={<HabitsPage />} />
        <Route path="/ritual" element={<RitualPage />} />
        <Route path="/semana" element={<PlannerPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/objetivos" element={<GoalsPage />} />
        <Route path="/rueda" element={<WheelPage />} />
        <Route path="/estadisticas" element={<StatsPage />} />
        <Route path="/memento" element={<MementoPage />} />
        <Route path="/ajustes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
