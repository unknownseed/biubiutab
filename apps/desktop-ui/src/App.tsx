import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import PlayPage from "./pages/PlayPage";
import EditorPage from "./pages/EditorPage";
import PracticePage from "./pages/PracticePage";
import AiOfflineBanner from "./components/AiOfflineBanner";

export default function App() {
  return (
    <>
      <AiOfflineBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/editor/:jobId" element={<EditorPage />} />
        <Route path="/practice/:jobId" element={<PracticePage />} />
        <Route path="/" element={<Navigate to="/play" replace />} />
        <Route path="*" element={<Navigate to="/play" replace />} />
      </Routes>
    </>
  );
}
