import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Persons from './pages/Persons'
import Cameras from './pages/Cameras'
import MediaUpload from './pages/MediaUpload'
import AlertLog from './pages/AlertLog'
import ReviewQueue from './pages/ReviewQueue'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5000 } } })

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="persons" element={<Persons />} />
            <Route path="cameras" element={<Cameras />} />
            <Route path="upload" element={<MediaUpload />} />
            <Route path="alerts" element={<AlertLog />} />
            <Route path="review" element={<ReviewQueue />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
