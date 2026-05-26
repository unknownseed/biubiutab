import { Route, Routes } from "react-router-dom";
import DefaultLayout from "./components/DefaultLayout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PlayPage from "./pages/PlayPage";
import EditorPage from "./pages/EditorPage";
import PracticePage from "./pages/PracticePage";
import DashboardPage from "./pages/DashboardPage";
import LearnPage from "./pages/LearnPage";
import LessonPage from "./pages/LessonPage";
import AdminTeachingListPage from "./pages/AdminTeachingListPage";
import AdminTeachingEditPage from "./pages/AdminTeachingEditPage";
import UpdatePasswordPage from "./pages/UpdatePasswordPage";
import AiOfflineBanner from "./components/AiOfflineBanner";
import DawLayout from "./layouts/DawLayout";

export default function App() {
  return (
    <>
      <AiOfflineBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<DawLayout />} />
        <Route element={<DefaultLayout />}>
          <Route path="/old" element={<HomePage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/editor/:jobId" element={<EditorPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/learn/:slug/:module" element={<LessonPage />} />
          <Route path="/admin/teaching" element={<AdminTeachingListPage />} />
          <Route path="/admin/teaching/:songId" element={<AdminTeachingEditPage />} />
          <Route path="/update-password" element={<UpdatePasswordPage />} />
        </Route>
        <Route path="/practice/:jobId" element={<PracticePage />} />
      </Routes>
    </>
  );
}
