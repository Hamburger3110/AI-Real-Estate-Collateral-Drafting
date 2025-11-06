
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import 'antd/dist/reset.css';

import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginScreen from './components/LoginScreen';
import DocumentUploadScreen from './components/DocumentUploadScreen';
import ContractListScreen from './components/ContractListScreen';
import MultiStepApprovalScreen from './components/MultiStepApprovalScreen';
import ContractReviewScreen from './components/ContractReviewScreen';
import ContractGenerationScreen from './components/ContractGenerationScreen';
import ApprovalDashboard from './components/ApprovalDashboard';
import ApprovalWorkflowScreen from './components/ApprovalWorkflowScreen';
import ActivityLogsScreen from './components/ActivityLogsScreen';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <div className="App">
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route 
              path="/" 
              element={<Navigate to="/contracts" replace />} 
            />
            <Route 
              path="/upload" 
              element={
                <ProtectedRoute requiredPermissions={['UPLOAD_DOCUMENTS']}>
                  <DocumentUploadScreen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/contracts" 
              element={
                <ProtectedRoute requiredPermissions={['VIEW_CONTRACTS']}>
                  <ContractListScreen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/approval" 
              element={
                <ProtectedRoute requiredPermissions={['CREDIT_REVIEW', 'LEGAL_REVIEW', 'FINAL_APPROVAL']}>
                  <MultiStepApprovalScreen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/approvals" 
              element={
                <ProtectedRoute requiredPermissions={['CREDIT_REVIEW', 'LEGAL_REVIEW', 'FINAL_APPROVAL']}>
                  <ApprovalDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/approvals/:contractId" 
              element={
                <ProtectedRoute requiredPermissions={['VIEW_CONTRACTS']}>
                  <ApprovalWorkflowScreen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/contracts/:contractId/generate" 
              element={
                <ProtectedRoute requiredPermissions={['VIEW_CONTRACTS']}>
                  <ContractGenerationScreen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/review" 
              element={
                <ProtectedRoute requiredPermissions={['VIEW_CONTRACTS']}>
                  <ContractReviewScreen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/activity-logs" 
              element={
                <ProtectedRoute requiredPermissions={['VIEW_ACTIVITY_LOGS']}>
                  <ActivityLogsScreen />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/contracts" replace />} />
          </Routes>
        </div>
      </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
