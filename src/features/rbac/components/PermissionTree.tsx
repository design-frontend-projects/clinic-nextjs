// src/features/rbac/components/PermissionTree.tsx
"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Key } from "lucide-react";
import { cn } from "@/lib/utils";
import { PermissionBadge } from "./PermissionBadge";

interface Permission {
  id: string;
  name: string;
  description: string | null;
}

interface TreeNode {
  key: string;
  label: string;
  fullName?: string;
  permission?: Permission;
  children: Record<string, TreeNode>;
}

function buildTree(permissions: Permission[]): Record<string, TreeNode> {
  const root: Record<string, TreeNode> = {};

  for (const perm of permissions) {
    const parts = perm.name.split(".");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join(".");

      if (!currentLevel[part]) {
        currentLevel[part] = {
          key: currentPath,
          label: part,
          children: {}
        };
      }

      if (isLast) {
        currentLevel[part].permission = perm;
        currentLevel[part].fullName = perm.name;
      }

      currentLevel = currentLevel[part].children;
    }
  }

  return root;
}

interface NodeProps {
  node: TreeNode;
  selectedIds: string[];
  onToggle: (id: string) => void;
  level: number;
}

function TreeNodeComponent({ node, selectedIds, onToggle, level }: NodeProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = Object.keys(node.children).length > 0;
  const isLeaf = !!node.permission;
  const isChecked = isLeaf && selectedIds.includes(node.permission!.id);

  return (
    <div className="select-none font-inter">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md py-1.5 px-2 hover:bg-surface-elevated transition-colors",
          isLeaf ? "cursor-pointer" : "cursor-default"
        )}
        onClick={() => {
          if (isLeaf) {
            onToggle(node.permission!.id);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="flex h-5 w-5 items-center justify-center text-mute hover:text-ink"
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {isLeaf ? (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggle(node.permission!.id)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Key className="h-4 w-4 text-mute shrink-0" />
        )}

        <span className={cn("text-sm", !isLeaf ? "font-semibold text-ink" : "text-mute")}>
          {node.label}
        </span>

        {isLeaf && node.permission?.description && (
          <span className="text-xs text-mute/60 hidden md:inline truncate ml-2">
            — {node.permission.description}
          </span>
        )}

        {isLeaf && (
          <div className="ml-auto">
            <PermissionBadge action={node.label} />
          </div>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="flex flex-col">
          {Object.values(node.children).map((child) => (
            <TreeNodeComponent
              key={child.key}
              node={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PermissionTreeProps {
  permissions: Permission[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function PermissionTree({ permissions, selectedIds, onToggle }: PermissionTreeProps) {
  const tree = buildTree(permissions);

  return (
    <div className="rounded-lg border border-hairline bg-surface p-4 space-y-1">
      {Object.keys(tree).length === 0 ? (
        <div className="py-6 text-center text-sm text-mute">No permissions available</div>
      ) : (
        Object.values(tree).map((rootNode) => (
          <TreeNodeComponent
            key={rootNode.key}
            node={rootNode}
            selectedIds={selectedIds}
            onToggle={onToggle}
            level={0}
          />
        ))
      )}
    </div>
  );
}
