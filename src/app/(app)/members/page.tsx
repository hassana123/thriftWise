"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  type ColumnDef,
} from "@tanstack/react-table";
import { Check, Clock3, ShieldCheck, UserCheck, UserPlus, UserX, X } from "lucide-react";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useThrift } from "@/providers/thrift-provider";
import { useAuth } from "@/providers/auth-provider";
import { formatMoney, formatMoneyCompact, initials, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMemberPlan, getTotalSaved } from "@/domain/calculations";
import { AddMemberDialog } from "@/components/members/add-member-dialog";
import { AdminControlPanel } from "@/components/members/admin-control-panel";
import type { Member, ThriftState } from "@/domain/types";

interface Row {
  member: Member;
  planLabel: string;
  saved: number;
  progress: number;
  completedWeeks: number;
  totalWeeks: number;
}

export default function MembersPage() {
  const { state } = useThrift();
  const { member: me } = useAuth();
  const [addOpen, setAddOpen] = React.useState(false);

  if (!state) return null;

  const rows = buildRows(state);
  const isAdmin = me?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Family members</h1>
          <p className="text-sm text-muted-foreground">Your family thrift circle</p>
        </div>
        {isAdmin ? (
          <Button onClick={() => setAddOpen(true)} className="gap-1.5">
            <UserPlus className="size-4" /> Add member
          </Button>
        ) : null}
      </div>
      <MemberTable rows={rows} />
      {isAdmin ? (
        <>
          <AdminControlPanel />
          <Approvals />
        </>
      ) : null}
      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function buildRows(state: ThriftState): Row[] {
  return state.members.map((member) => {
    const plan = getMemberPlan(state, member.id);
    const saved = getTotalSaved(state, member.id);
    const totalWeeks = state.weeks.length;
    const completedWeeks = state.payments.filter(
      (p) => p.memberId === member.id && p.status === "approved"
    ).length;
    const progress = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0;
    return {
      member,
      planLabel: plan?.label ?? "—",
      saved,
      progress,
      completedWeeks,
      totalWeeks,
    };
  });
}

const columnHelper = createColumnHelper<Row>();

function MemberTable({ rows }: { rows: Row[] }) {
  const { member: me } = useAuth();
  const isAdmin = me?.role === "admin";

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      columnHelper.display({
        id: "member",
        header: "Member",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback style={{ backgroundColor: row.original.member.color }} className="text-white text-xs">
                {initials(row.original.member.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                {row.original.member.name}
                {row.original.member.role === "admin" ? (
                  <ShieldCheck className="size-3.5 shrink-0 text-primary" />
                ) : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">{row.original.planLabel}</p>
            </div>
          </div>
        ),
      }),
      columnHelper.display({
        id: "progress",
        header: () => <span className="hidden sm:block">Progress</span>,
        cell: ({ row }) => (
          <div className="hidden min-w-32 items-center gap-2 sm:flex">
            <Progress value={row.original.progress} className="h-2 flex-1" />
            <span className="text-xs font-semibold text-muted-foreground">{row.original.progress}%</span>
          </div>
        ),
      }),
      columnHelper.display({
        id: "saved",
        header: () => <span className="text-right">Saved</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <p className="text-sm font-bold">{formatMoneyCompact(row.original.saved)}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.completedWeeks}/{row.original.totalWeeks} weeks
            </p>
          </div>
        ),
      }),
      columnHelper.display({
        id: "status",
        header: () => <span className="hidden text-right md:block">Status</span>,
        cell: ({ row }) => (
          <div className="hidden justify-end md:flex">
            <Badge variant={row.original.member.status === "active" ? "success" : "muted"}>
              {row.original.member.status}
            </Badge>
          </div>
        ),
      }),
      ...(isAdmin
        ? [
            columnHelper.display({
              id: "actions",
              header: () => <span className="sr-only">Actions</span>,
              cell: ({ row }) => (
                <div className="flex justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={row.original.member.status === "suspended" ? "Reactivate" : "Suspend"}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      // TODO: wire to repository suspend action
                    }}
                  >
                    {row.original.member.status === "suspended" ? <UserCheck className="size-4" /> : <UserX className="size-4" />}
                  </Button>
                </div>
              ),
            }),
          ]
        : []),
    ],
    [isAdmin]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b">
                  {hg.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b last:border-0 hover:bg-muted/40"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn("px-4 py-3.5", cell.column.id === "saved" && "text-right")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Approvals() {
  const { state, approvePayment, rejectPayment } = useThrift();
  if (!state) return null;

  const pending = state.payments.filter((p) => p.receiptStatus === "pending");
  if (pending.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Check className="size-6 text-primary" />
        </div>
        <p className="font-semibold">All receipts reviewed</p>
        <p className="text-sm text-muted-foreground">New uploads will appear here for approval.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">Awaiting approval</h3>
      {pending.map((payment) => {
        const member = state.members.find((m) => m.id === payment.memberId);
        const week = state.weeks.find((w) => w.id === payment.weekId);
        return (
          <Card key={payment.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback style={{ backgroundColor: member?.color }} className="text-white text-xs">
                  {initials(member?.name ?? "?")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {member?.name} · Week {week?.number}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3" /> Uploaded {formatDate(payment.createdAt, "MMM d")} · {formatMoney(payment.amount)}
                </p>
              </div>
              <Badge variant="warning">Pending</Badge>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1" onClick={() => approvePayment(payment.memberId, payment.weekId)}>
                  <Check className="size-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => rejectPayment(payment.memberId, payment.weekId, "Receipt unclear, please re-upload")}>
                  <X className="size-3.5" /> Reject
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
