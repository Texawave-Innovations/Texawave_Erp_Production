// src/modules/projects/mom/components/AgendaListManager.tsx

import React, { useState } from "react";
import { MomAgendaItem } from "../types/mom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ArrowUp, ArrowDown, ListOrdered } from "lucide-react";

interface AgendaListManagerProps {
  agenda: MomAgendaItem[];
  onChange: (agenda: MomAgendaItem[]) => void;
  disabled?: boolean;
}

export const AgendaListManager: React.FC<AgendaListManagerProps> = ({
  agenda,
  onChange,
  disabled = false,
}) => {
  const [newTopic, setNewTopic] = useState("");

  const handleAddItem = () => {
    if (!newTopic.trim()) return;
    const newItem: MomAgendaItem = {
      id: `ag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      order: agenda.length + 1,
      topic: newTopic.trim(),
    };
    onChange([...agenda, newItem]);
    setNewTopic("");
  };

  const handleUpdateTopic = (id: string, topic: string) => {
    onChange(agenda.map((it) => (it.id === id ? { ...it, topic } : it)));
  };

  const handleDeleteItem = (id: string) => {
    const filtered = agenda.filter((it) => it.id !== id);
    onChange(filtered.map((it, idx) => ({ ...it, order: idx + 1 })));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const items = [...agenda];
    const temp = items[index - 1];
    items[index - 1] = items[index];
    items[index] = temp;
    onChange(items.map((it, idx) => ({ ...it, order: idx + 1 })));
  };

  const handleMoveDown = (index: number) => {
    if (index >= agenda.length - 1) return;
    const items = [...agenda];
    const temp = items[index + 1];
    items[index + 1] = items[index];
    items[index] = temp;
    onChange(items.map((it, idx) => ({ ...it, order: idx + 1 })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <ListOrdered className="h-4 w-4 text-primary" /> Numbered Agenda
        </h3>
      </div>

      {!disabled && (
        <div className="flex items-center gap-2">
          <Input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Add new agenda topic..."
            className="text-xs h-9 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddItem();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddItem}
            disabled={!newTopic.trim()}
            style={{
              background:
                "linear-gradient(135deg, #4D9F4B 0%, #72B84A 50%, #9FCA48 100%)",
            }}
            className="text-white font-bold rounded-xl text-xs h-9 px-3 shadow-xs shrink-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Topic
          </Button>
        </div>
      )}

      {agenda.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center italic border border-dashed border-border rounded-xl">
          No agenda topics added yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {agenda.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-xl bg-card border border-border text-xs"
            >
              <span className="font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-lg text-xs shrink-0">
                {index + 1}.0
              </span>
              <Input
                disabled={disabled}
                value={item.topic}
                onChange={(e) => handleUpdateTopic(item.id, e.target.value)}
                placeholder="Agenda topic"
                className="text-xs h-8 flex-1 border-0 focus-visible:ring-1"
              />
              {!disabled && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="Move up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={index === agenda.length - 1}
                    onClick={() => handleMoveDown(index)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="Move down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDeleteItem(item.id)}
                    className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                    title="Delete topic"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
