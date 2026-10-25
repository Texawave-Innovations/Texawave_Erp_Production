// src/modules/projects/mom/components/MeetingNotesTable.tsx

import React from "react";
import { MomNoteRow } from "../types/mom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

interface MeetingNotesTableProps {
  rows: MomNoteRow[];
  onChange: (rows: MomNoteRow[]) => void;
  disabled?: boolean;
}

export const MeetingNotesTable: React.FC<MeetingNotesTableProps> = ({
  rows,
  onChange,
  disabled = false,
}) => {
  const handleAddRow = () => {
    const newRow: MomNoteRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      order: rows.length + 1,
      agendaItem: "",
      discussionPoints: "",
      actionItems: "",
    };
    onChange([...rows, newRow]);
  };

  const handleUpdateRow = (
    id: string,
    field: keyof MomNoteRow,
    value: string,
  ) => {
    const updated = rows.map((r) =>
      r.id === id ? { ...r, [field]: value } : r,
    );
    onChange(updated);
  };

  const handleDeleteRow = (id: string) => {
    const filtered = rows.filter((r) => r.id !== id);
    const reordered = filtered.map((r, idx) => ({ ...r, order: idx + 1 }));
    onChange(reordered);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newRows = [...rows];
    const temp = newRows[index - 1];
    newRows[index - 1] = newRows[index];
    newRows[index] = temp;
    onChange(newRows.map((r, idx) => ({ ...r, order: idx + 1 })));
  };

  const handleMoveDown = (index: number) => {
    if (index >= rows.length - 1) return;
    const newRows = [...rows];
    const temp = newRows[index + 1];
    newRows[index + 1] = newRows[index];
    newRows[index] = temp;
    onChange(newRows.map((r, idx) => ({ ...r, order: idx + 1 })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Meeting Notes & Deliberations
          </h3>
          <p className="text-xs text-muted-foreground">
            Document discussion points and corresponding manual action items
            linked to agenda topics.
          </p>
        </div>
        {!disabled && (
          <Button
            type="button"
            size="sm"
            onClick={handleAddRow}
            style={{
              background:
                "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
            }}
            className="text-white font-bold rounded-xl text-xs h-8 shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-b border-border text-xs uppercase font-extrabold text-muted-foreground">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead className="w-1/4">Agenda Item</TableHead>
              <TableHead className="w-2/5">Discussion Points</TableHead>
              <TableHead className="w-2/5">Action Items</TableHead>
              {!disabled && (
                <TableHead className="w-20 text-center">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={disabled ? 4 : 5}
                  className="h-28 text-center text-xs text-muted-foreground"
                >
                  No meeting notes rows yet.{" "}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="text-primary font-bold hover:underline ml-1"
                    >
                      Click here to add the first row.
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border hover:bg-muted/20 align-top"
                >
                  <TableCell className="text-center font-bold text-xs text-muted-foreground pt-4">
                    {index + 1}
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      disabled={disabled}
                      value={row.agendaItem}
                      onChange={(e) =>
                        handleUpdateRow(row.id, "agendaItem", e.target.value)
                      }
                      placeholder="e.g. Milestone 2 Deliverables"
                      className="text-xs h-9 font-medium"
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Textarea
                      disabled={disabled}
                      value={row.discussionPoints}
                      onChange={(e) =>
                        handleUpdateRow(
                          row.id,
                          "discussionPoints",
                          e.target.value,
                        )
                      }
                      placeholder="Enter detailed deliberations, consensus, and key notes..."
                      className="text-xs min-h-[72px] resize-y"
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Textarea
                      disabled={disabled}
                      value={row.actionItems}
                      onChange={(e) =>
                        handleUpdateRow(row.id, "actionItems", e.target.value)
                      }
                      placeholder="Enter manual action items, owners, and agreed target dates..."
                      className="text-xs min-h-[72px] resize-y"
                    />
                  </TableCell>
                  {!disabled && (
                    <TableCell className="p-2 text-center pt-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={index === 0}
                          onClick={() => handleMoveUp(index)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Move row up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={index === rows.length - 1}
                          onClick={() => handleMoveDown(index)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Move row down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleDeleteRow(row.id)}
                          className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          title="Delete row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
