
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import 'antd/dist/reset.css';

import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginScreen from './LoginScreen';
import DocumentUploadScreen from './DocumentUploadScreen';
import ContractListScreen from './ContractListScreen';
import MultiStepApprovalScreen from './MultiStepApprovalScreen';
import ContractReviewScreen from './ContractReviewScreen';
import ApprovalDashboard from './ApprovalDashboard';
import ApprovalWorkflowScreen from './ApprovalWorkflowScreen';

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
              path="/review" 
              element={
                <ProtectedRoute requiredPermissions={['VIEW_CONTRACTS']}>
                  <ContractReviewScreen />
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
