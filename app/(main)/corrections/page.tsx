'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, Button, Badge, Avatar, Textarea } from '@/components/ui';
import { CorrectionWithDetails } from '@/types';
import { format } from 'date-fns';
import {
  FileEdit,
  Clock,
  Check,
  X,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function CorrectionsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'mine'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminComment, setAdminComment] = useState('');

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: CorrectionWithDetails[];
  }>(`/api/corrections?type=${activeTab}`, fetcher);

  const handleProcess = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setProcessingId(id);
    try {
      const response = await fetch(`/api/corrections/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminComment }),
      });

      if (response.ok) {
        mutate();
        setAdminComment('');
      }
    } catch (error) {
      console.error('Error processing correction:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>;
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Correction Requests</h1>
            <p className="text-slate-600 mt-1">
              Submit and review corrections to family member information
            </p>
          </div>
          <Link href="/corrections/new">
            <Button>
              <FileEdit className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'pending'
                ? 'bg-maroon-100 text-maroon-700'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending Review
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'mine'
                ? 'bg-maroon-100 text-maroon-700'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            My Requests
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-maroon-500 animate-spin" />
          </div>
        ) : error ? (
          <Card className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <p className="text-slate-600">Failed to load corrections</p>
            <Button onClick={() => mutate()} className="mt-4">
              Try Again
            </Button>
          </Card>
        ) : data?.data?.length === 0 ? (
          <Card className="text-center py-12">
            <FileEdit className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              No Correction Requests
            </h3>
            <p className="text-slate-600 mb-6">
              {activeTab === 'pending'
                ? 'There are no pending correction requests.'
                : 'You haven\'t submitted any correction requests yet.'}
            </p>
            <Link href="/corrections/new">
              <Button>Submit a Correction</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {data?.data?.map((correction) => (
              <Card key={correction.id} hover>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar
                      src={correction.person.profileImage?.url}
                      name={`${correction.person.firstName} ${correction.person.lastName}`}
                      size="lg"
                    />
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {correction.person.firstName} {correction.person.lastName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-500">
                          by {correction.requestedBy.name}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-sm text-slate-500">
                          {format(new Date(correction.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(correction.status)}
                </div>

                {/* Reason */}
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium text-slate-700 mb-1">Reason for correction:</p>
                  <p className="text-sm text-slate-600">{correction.reason}</p>
                </div>

                {/* Expand/collapse */}
                <button
                  onClick={() => setExpandedId(expandedId === correction.id ? null : correction.id)}
                  className="flex items-center gap-2 mt-4 text-sm text-maroon-600 hover:text-maroon-700"
                >
                  {expandedId === correction.id ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      View Changes
                    </>
                  )}
                </button>

                {expandedId === correction.id && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Current Data</h4>
                        <pre className="text-xs bg-slate-50 p-4 rounded-lg overflow-x-auto">
                          {JSON.stringify(correction.currentData, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Proposed Changes</h4>
                        <pre className="text-xs bg-maroon-50 p-4 rounded-lg overflow-x-auto">
                          {JSON.stringify(correction.proposedData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin actions */}
                {correction.status === 'PENDING' && activeTab === 'pending' && (
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <Textarea
                      value={adminComment}
                      onChange={(e) => setAdminComment(e.target.value)}
                      placeholder="Optional: Add a comment..."
                      rows={2}
                      className="mb-3"
                    />
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleProcess(correction.id, 'APPROVED')}
                        isLoading={processingId === correction.id}
                        className="flex-1"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approve & Apply
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleProcess(correction.id, 'REJECTED')}
                        isLoading={processingId === correction.id}
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                )}

                {/* Admin comment if rejected */}
                {correction.status === 'REJECTED' && correction.adminComment && (
                  <div className="mt-4 p-4 bg-rose-50 rounded-lg">
                    <p className="text-sm font-medium text-rose-700 mb-1">Admin comment:</p>
                    <p className="text-sm text-rose-600">{correction.adminComment}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

