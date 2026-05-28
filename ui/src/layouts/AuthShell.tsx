import { type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { css } from "styled-system/css";

const SUNBEAM_GRADIENT = [
  "#ffd900",
  "#ffe295",
  "#ffd06a",
  "#ffb83e",
  "#ffa110",
  "#ff8a00",
  "#ff8105",
  "#fa520f",
];

/** Centered card layout for self-service flows + Hydra screens. */
export function AuthShell(): ReactNode {
  return (
    <div
      className={css({
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        bg: "bg.page",
        padding: "32px 16px",
      })}
    >
      <div
        className={css({
          width: "100%",
          maxWidth: "420px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        })}
      >
        <div
          className={css({
            width: "120px",
            height: "6px",
            display: "flex",
            gap: "2px",
            margin: "0 auto",
          })}
        >
          {SUNBEAM_GRADIENT.map((c) => (
            <span key={c} style={{ flex: 1, background: c }} />
          ))}
        </div>
        <Outlet />
      </div>
    </div>
  );
}
