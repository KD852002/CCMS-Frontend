'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Chip, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Tooltip, CircularProgress, Alert, Switch,
  FormControlLabel, Tabs, Tab, Select, MenuItem, FormControl, InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add, Edit, Delete, Refresh, Settings as SettingsIcon, Email as EmailIcon,
  AdminPanelSettings, Send, PhoneInTalk, WhatsApp, MailOutline,
} from '@mui/icons-material';
import AppLayout from '@/components/AppLayout';
import {
  fetchEmailRecipients, addEmailRecipient, updateEmailRecipient, deleteEmailRecipient,
  fetchUsers, updateUser, deleteUser, testNotification,
  testEmailRecipient, testWhatsappRecipient, testCallRecipient,
} from '@/lib/api';

const C = { teal: '#0d7377' };

interface EmailRecipient {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  notify_faults: boolean;
  notify_reports: boolean;
  is_active: boolean;
  created_at: string;
}

interface User {
  id: number;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

const EMPTY_EMAIL = { name: '', email: '', phone: '', notify_faults: true, notify_reports: true, is_active: true };

export default function SettingsPage() {
  const [tab, setTab] = useState(0);

  /* ── Email Recipients state ─────────────────────────── */
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailDialog, setEmailDialog] = useState(false);
  const [editRecipient, setEditRecipient] = useState<EmailRecipient | null>(null);
  const [emailForm, setEmailForm] = useState(EMPTY_EMAIL);
  const [emailError, setEmailError] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState<{id:number; type:string} | null>(null);

  /* ── Users state ──────────────────────────────────────── */
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ full_name: '', email: '', role: 'operator', is_active: true });
  const [userError, setUserError] = useState('');
  const [userSaving, setUserSaving] = useState(false);

  const loadRecipients = useCallback(() => {
    setEmailLoading(true);
    fetchEmailRecipients().then(setRecipients).catch(console.error).finally(() => setEmailLoading(false));
  }, []);

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    fetchUsers().then(setUsers).catch(console.error).finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => { loadRecipients(); loadUsers(); }, [loadRecipients, loadUsers]);

  /* ── Email CRUD ───────────────────────────────────────── */
  const openCreateEmail = () => {
    setEditRecipient(null);
    setEmailForm(EMPTY_EMAIL);
    setEmailError('');
    setEmailDialog(true);
  };

  const openEditEmail = (r: EmailRecipient) => {
    setEditRecipient(r);
    setEmailForm({ name: r.name, email: r.email, phone: r.phone ?? '', notify_faults: r.notify_faults, notify_reports: r.notify_reports, is_active: r.is_active });
    setEmailError('');
    setEmailDialog(true);
  };

  const handleTest = async (id: number, type: 'email' | 'whatsapp' | 'call') => {
    setTesting({ id, type });
    setTestResult(null);
    try {
      const fn = type === 'email' ? testEmailRecipient : type === 'whatsapp' ? testWhatsappRecipient : testCallRecipient;
      const res = await fn(id);
      setTestResult(`✅ ${res.detail}`);
    } catch (e: any) {
      setTestResult(`❌ ${e?.response?.data?.detail ?? 'Request failed'}`);
    } finally {
      setTesting(null);
    }
  };

  const handleSaveEmail = async () => {
    if (!emailForm.name.trim() || !emailForm.email.trim()) { setEmailError('Name and email are required'); return; }
    setEmailSaving(true);
    try {
      if (editRecipient) {
        await updateEmailRecipient(editRecipient.id, emailForm);
      } else {
        await addEmailRecipient(emailForm);
      }
      setEmailDialog(false);
      loadRecipients();
    } catch {
      setEmailError('Failed to save recipient');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleDeleteEmail = async (id: number) => {
    if (!confirm('Delete this recipient?')) return;
    try { await deleteEmailRecipient(id); loadRecipients(); } catch { alert('Failed to delete'); }
  };

  /* ── User CRUD ────────────────────────────────────────── */
  const openEditUser = (u: User) => {
    setEditingUser(u);
    setUserForm({ full_name: u.full_name || '', email: u.email || '', role: u.role, is_active: u.is_active });
    setUserError('');
    setUserDialog(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;
    setUserSaving(true);
    try {
      await updateUser(editingUser.id, {
        full_name: userForm.full_name,
        email: userForm.email,
        role: userForm.role,
        is_active: userForm.is_active,
      } as Record<string, string | boolean>);
      setUserDialog(false);
      loadUsers();
    } catch {
      setUserError('Failed to update user');
    } finally {
      setUserSaving(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try { await deleteUser(id); loadUsers(); } catch { alert('Failed to delete user'); }
  };

  return (
    <AppLayout>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <SettingsIcon sx={{ color: C.teal, fontSize: 30 }} />
          <Typography variant="h5" fontWeight={700}>Settings</Typography>
        </Box>

        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab icon={<EmailIcon fontSize="small" />} iconPosition="start" label="Email Recipients" />
          <Tab icon={<AdminPanelSettings fontSize="small" />} iconPosition="start" label="User Management" />
        </Tabs>

        {/* ── Tab 0: Email Recipients ─────────────────────── */}
        {tab === 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>Email Notification Recipients</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {testResult && <Typography variant="caption" sx={{ color: testResult.startsWith('✓') ? 'success.main' : 'error.main' }}>{testResult}</Typography>}
                <Tooltip title="Send a test email to all active recipients">
                  <span>
                    <Button variant="outlined" size="small" startIcon={<Send fontSize="small" />}
                      disabled={testSending}
                      onClick={async () => {
                        setTestSending(true); setTestResult(null);
                        try { await testNotification(); setTestResult('✓ Test email sent'); }
                        catch { setTestResult('✗ Failed to send'); }
                        setTestSending(false);
                      }}
                      sx={{ textTransform: 'none', borderColor: C.teal, color: C.teal }}>
                      {testSending ? 'Sending…' : 'Test Email'}
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Refresh"><IconButton size="small" onClick={loadRecipients}><Refresh /></IconButton></Tooltip>
                <Button variant="contained" startIcon={<Add />} sx={{ bgcolor: C.teal }} onClick={openCreateEmail}>Add Recipient</Button>
              </Box>
            </Box>

            <Card sx={{ borderRadius: 3 }}>
              {emailLoading ? (
                <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={32} /></Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell align="center">Fault Alerts</TableCell>
                        <TableCell align="center">Reports</TableCell>
                        <TableCell align="center">Active</TableCell>
                        <TableCell>Added</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recipients.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                            No recipients configured
                          </TableCell>
                        </TableRow>
                      ) : recipients.map((r) => (
                        <TableRow key={r.id} hover>
                          <TableCell sx={{ fontWeight: 500 }}>{r.name}</TableCell>
                          <TableCell>{r.email}</TableCell>
                          <TableCell>{r.phone || <span style={{color:'#aaa'}}>—</span>}</TableCell>
                          <TableCell align="center">
                            <Chip label={r.notify_faults ? 'Yes' : 'No'} color={r.notify_faults ? 'error' : 'default'} size="small" />
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={r.notify_reports ? 'Yes' : 'No'} color={r.notify_reports ? 'info' : 'default'} size="small" />
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={r.is_active ? 'Active' : 'Inactive'} color={r.is_active ? 'success' : 'default'} size="small" />
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                            {new Date(r.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                              <Tooltip title="Test Email">
                                <IconButton size="small" color="info" disabled={!!testing} onClick={() => handleTest(r.id, 'email')}>
                                  {testing?.id === r.id && testing.type === 'email' ? <CircularProgress size={14} /> : <MailOutline fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={r.phone ? 'Test WhatsApp' : 'No phone — add one to test'}>
                                <span>
                                  <IconButton size="small" color="success" disabled={!!testing || !r.phone} onClick={() => handleTest(r.id, 'whatsapp')}>
                                    {testing?.id === r.id && testing.type === 'whatsapp' ? <CircularProgress size={14} /> : <WhatsApp fontSize="small" />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title={r.phone ? 'Test Voice Call' : 'No phone — add one to test'}>
                                <span>
                                  <IconButton size="small" color="warning" disabled={!!testing || !r.phone} onClick={() => handleTest(r.id, 'call')}>
                                    {testing?.id === r.id && testing.type === 'call' ? <CircularProgress size={14} /> : <PhoneInTalk fontSize="small" />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditEmail(r)}><Edit fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDeleteEmail(r.id)}><Delete fontSize="small" /></IconButton></Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Card>
            {testResult && (
              <Alert severity={testResult.startsWith('✅') ? 'success' : 'error'} onClose={() => setTestResult(null)} sx={{ mt: 2 }}>
                {testResult}
              </Alert>
            )}
          </Box>
        )}

        {/* ── Tab 1: User Management ──────────────────────── */}
        {tab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>System Users</Typography>
              <Tooltip title="Refresh"><IconButton size="small" onClick={loadUsers}><Refresh /></IconButton></Tooltip>
            </Box>

            <Card sx={{ borderRadius: 3 }}>
              {usersLoading ? (
                <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={32} /></Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Username</TableCell>
                        <TableCell>Full Name</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell align="center">Role</TableCell>
                        <TableCell align="center">Active</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No users found</TableCell>
                        </TableRow>
                      ) : users.map((u) => (
                        <TableRow key={u.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{u.username}</TableCell>
                          <TableCell>{u.full_name || '—'}</TableCell>
                          <TableCell>{u.email || '—'}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={u.role.toUpperCase()}
                              color={u.role === 'admin' ? 'warning' : u.role === 'operator' ? 'info' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={u.is_active ? 'Active' : 'Inactive'} color={u.is_active ? 'success' : 'default'} size="small" />
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                            {new Date(u.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                              <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditUser(u)}><Edit fontSize="small" /></IconButton></Tooltip>
                              <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDeleteUser(u.id)}><Delete fontSize="small" /></IconButton></Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Card>
          </Box>
        )}

        {/* ── Email Recipient Dialog ──────────────────────── */}
        <Dialog open={emailDialog} onClose={() => setEmailDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{editRecipient ? 'Edit Recipient' : 'Add Recipient'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {emailError && <Alert severity="error">{emailError}</Alert>}
            <TextField label="Name *" value={emailForm.name} onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })} fullWidth size="small" />
            <TextField label="Email *" type="email" value={emailForm.email} onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })} fullWidth size="small" />
            <TextField label="Phone (WhatsApp + Voice call)" placeholder="+919876543210" value={emailForm.phone} onChange={(e) => setEmailForm({ ...emailForm, phone: e.target.value })} fullWidth size="small" helperText="E.164 format – leave blank to skip calls" />
            <FormControlLabel control={<Switch checked={emailForm.notify_faults} onChange={(e) => setEmailForm({ ...emailForm, notify_faults: e.target.checked })} />} label="Notify on Faults" />
            <FormControlLabel control={<Switch checked={emailForm.notify_reports} onChange={(e) => setEmailForm({ ...emailForm, notify_reports: e.target.checked })} />} label="Notify on Reports" />
            <FormControlLabel control={<Switch checked={emailForm.is_active} onChange={(e) => setEmailForm({ ...emailForm, is_active: e.target.checked })} />} label="Active" />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEmailDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveEmail} disabled={emailSaving} sx={{ bgcolor: C.teal }}>
              {emailSaving ? <CircularProgress size={16} color="inherit" /> : editRecipient ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── User Edit Dialog ────────────────────────────── */}
        <Dialog open={userDialog} onClose={() => setUserDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Edit User: {editingUser?.username}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {userError && <Alert severity="error">{userError}</Alert>}
            <TextField label="Full Name" value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} fullWidth size="small" />
            <TextField label="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} fullWidth size="small" />
            <FormControl size="small" fullWidth>
              <InputLabel>Role</InputLabel>
              <Select value={userForm.role} label="Role" onChange={(e: SelectChangeEvent) => setUserForm({ ...userForm, role: e.target.value })}>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel control={<Switch checked={userForm.is_active} onChange={(e) => setUserForm({ ...userForm, is_active: e.target.checked })} />} label="Active" />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUserDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveUser} disabled={userSaving} sx={{ bgcolor: C.teal }}>
              {userSaving ? <CircularProgress size={16} color="inherit" /> : 'Update'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppLayout>
  );
}
