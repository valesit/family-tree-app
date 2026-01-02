'use client';

import { useState } from 'react';
import { PendingChangeWithDetails } from '@/types';
import { Card, Button, Badge, Avatar, Textarea } from '@/components/ui';
import { format } from 'date-fns';
import {
  User,
  UserPlus,
  Edit,
  Trash2,
  Link,
  Image,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';

interface ApprovalCardProps {
  change: PendingChangeWithDetails;
  onApprove: (id: string, comment?: string) => Promise<void>;
  onReject: (id: string, comment?: string) => Promise<void>;
  isProcessing?: boolean;
}

const changeTypeIcons: Record<string, typeof User> = {
  CREATE_PERSON: UserPlus,
  UPDATE_PERSON: Edit,
  DELETE_PERSON: Trash2,
  ADD_RELATIONSHIP: Link,
  UPDATE_RELATIONSHIP: Edit,
  DELETE_RELATIONSHIP: Trash2,
  ADD_IMAGE: Image,
  DELETE_IMAGE: Trash2,
};

const changeTypeLabels: Record<string, string> = {
  CREATE_PERSON: 'Add New Person',
  UPDATE_PERSON: 'Update Person',
  DELETE_PERSON: 'Remove Person',
  ADD_RELATIONSHIP: 'Add Relationship',
  UPDATE_RELATIONSHIP: 'Update Relationship',
  DELETE_RELATIONSHIP: 'Remove Relationship',
  ADD_IMAGE: 'Add Image',
  DELETE_IMAGE: 'Remove Image',
};

export function ApprovalCard({ change, onApprove, onReject, isProcessing }: ApprovalCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [comment, setComment] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const Icon = changeTypeIcons[change.changeType] || Edit;
  const changeData = change.changeData as Record<string, unknown>;

  const handleApprove = async () => {
    await onApprove(change.id, comment);
  };

  const handleReject = async () => {
    await onReject(change.id, comment);
    setShowRejectForm(false);
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
    <Card hover>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-maroon-100 rounded-xl flex items-center justify-center">
            <Icon className="w-6 h-6 text-maroon-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">
              {changeTypeLabels[change.changeType]}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Avatar
                src={change.createdBy.image}
                name={change.createdBy.name || 'User'}
                size="xs"
              />
              <span className="text-sm text-slate-500">
                by {change.createdBy.name}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-sm text-slate-500 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {format(new Date(change.createdAt), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
        {getStatusBadge(change.status)}
      </div>

      {/* Preview of changes */}
      {change.changeType === 'CREATE_PERSON' && (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-700">
            <span className="font-medium">New Person:</span>{' '}
            {String(changeData.firstName || '')} {String(changeData.lastName || '')}
          </p>
          {typeof changeData.birthDate === 'string' && changeData.birthDate && (
            <p className="text-sm text-slate-500 mt-1">
              Born: {changeData.birthDate}
            </p>
          )}
        </div>
      )}

      {change.changeType === 'UPDATE_PERSON' && change.person && (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <p className="text-sm text-slate-700">
            <span className="font-medium">Updating:</span>{' '}
            {change.person.firstName} {change.person.lastName}
          </p>
        </div>
      )}

      {/* Expand/collapse details */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 mt-4 text-sm text-maroon-600 hover:text-maroon-700"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide Details
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            View Details
          </>
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Proposed Changes</h4>
          <pre className="text-xs bg-slate-50 p-4 rounded-lg overflow-x-auto">
            {JSON.stringify(changeData, null, 2)}
          </pre>

          {/* Approvers status */}
          {change.approvals.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Approvers</h4>
              <div className="space-y-2">
                {change.approvals.map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={approval.approver.image}
                        name={approval.approver.name || 'Approver'}
                        size="xs"
                      />
                      <span className="text-sm text-slate-700">
                        {approval.approver.name}
                      </span>
                    </div>
                    {getStatusBadge(approval.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {change.status === 'PENDING' && (
        <div className="mt-6 pt-4 border-t border-slate-100">
          {showRejectForm ? (
            <div className="space-y-3">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Please provide a reason for rejection..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={handleReject}
                  isLoading={isProcessing}
                >
                  Confirm Rejection
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowRejectForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                onClick={handleApprove}
                isLoading={isProcessing}
                className="flex-1"
              >
                <Check className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRejectForm(true)}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

