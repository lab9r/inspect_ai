import { html } from "htm/preact";
import { useCallback, useMemo, useState } from "preact/hooks";
import { useEffect, useRef } from "preact/hooks";

import { ApplicationStyles } from "../appearance/Styles.mjs";
import { FontSize } from "../appearance/Fonts.mjs";
import { TextStyle } from "../appearance/Fonts.mjs";
import { MarkdownDiv } from "../components/MarkdownDiv.mjs";
import { SampleError } from "./SampleError.mjs";

import { arrayToString, formatNoDecimal } from "../utils/Format.mjs";
import { EmptyPanel } from "../components/EmptyPanel.mjs";
import { VirtualList } from "../components/VirtualList.mjs";
import { MessageBand } from "../components/MessageBand.mjs";
import { inputString } from "../utils/Format.mjs";

const kSampleHeight = 88;
const kSeparatorHeight = 24;

/**
 * Convert samples to a datastructure which contemplates grouping, etc...
 *
 * @param {Object} props - The parameters for the component.
 * @param {Object} props.listRef - The ref for the list.
 * @param {import("./SamplesTab.mjs").ListItem[]} props.items - The samples.
 * @param {import("../samples/SamplesDescriptor.mjs").SamplesDescriptor} props.sampleDescriptor - The sample descriptor.
 * @param {Object} props.style - The style for the element
 * @param {number} props.selectedIndex - The index of the selected sample.
 * @param {(index: number) => void} props.setSelectedIndex - The function to set the selected sample index.
 * @param {import("../Types.mjs").ScoreLabel} props.selectedScore - The function to get the selected score.
 * @param {() => void} props.nextSample - The function to move to the next sample.
 * @param {() => void} props.prevSample - The function to move to the previous sample.
 * @param {(index: number) => void} props.showSample - The function to show the sample.
 * @returns {import("preact").JSX.Element} The SampleList component.
 */
export const SampleList = (props) => {
  const {
    listRef,
    items,
    sampleDescriptor,
    style,
    selectedIndex,
    setSelectedIndex,
    selectedScore,
    nextSample,
    prevSample,
    showSample,
  } = props;
  // If there are no samples, just display an empty state
  if (items.length === 0) {
    return html`<${EmptyPanel}>No Samples</${EmptyPanel}>`;
  }

  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
  }, [items]);

  // Keep a mapping of the indexes to items (skipping separators)
  const itemRowMapping = useMemo(() => {
    const rowIndexes = [];
    items.forEach((item, index) => {
      if (item.type === "sample") {
        rowIndexes.push(index);
      }
    });
    return rowIndexes;
  }, [items]);

  const prevSelectedIndexRef = useRef(null);
  useEffect(() => {
    const listEl = listRef.current;
    if (listEl) {
      const actualRowIndex = itemRowMapping[selectedIndex];
      const direction =
        actualRowIndex > prevSelectedIndexRef.current ? "down" : "up";
      listRef.current?.scrollToIndex(actualRowIndex, direction);
      prevSelectedIndexRef.current = actualRowIndex;
    }
  }, [selectedIndex, listRef, itemRowMapping]);

  /** @param {import("./SamplesTab.mjs").ListItem} item */
  const renderRow = (item) => {
    if (item.type === "sample") {
      return html`
        <${SampleRow}
          id=${item.number}
          index=${item.index}
          sample=${item.data}
          height=${kSampleHeight}
          sampleDescriptor=${sampleDescriptor}
          selected=${selectedIndex === item.index}
          setSelected=${setSelectedIndex}
          selectedScore=${selectedScore}
          showSample=${showSample}
        />
      `;
    } else if (item.type === "separator") {
      return html`
        <${SeparatorRow}
          id=${`sample-group${item.number}`}
          title=${item.data}
          height=${kSeparatorHeight}
        />
      `;
    } else {
      return "";
    }
  };

  const onkeydown = useCallback(
    (e) => {
      switch (e.key) {
        case "ArrowUp":
          prevSample();
          e.preventDefault();
          e.stopPropagation();
          return false;
        case "ArrowDown":
          nextSample();
          e.preventDefault();
          e.stopPropagation();
          return false;
        case "Enter":
          showSample(selectedIndex);
          e.preventDefault();
          e.stopPropagation();
          return false;
      }
    },
    [selectedIndex],
  );

  const listStyle = { ...style, flex: "1", overflowY: "auto", outline: "none" };
  const { input, limit, answer, target } = gridColumns(sampleDescriptor);

  const headerRow = html`<div
    style=${{
      display: "grid",
      ...gridColumnStyles(sampleDescriptor),
      fontSize: FontSize.smaller,
      ...TextStyle.label,
      ...TextStyle.secondary,
      paddingBottom: "0.3em",
      paddingTop: "0.3em",
      borderBottom: "solid var(--bs-light-border-subtle) 1px",
    }}
  >
    <div>Id</div>
    <div>${input !== "0" ? "Input" : ""}</div>
    <div>${target !== "0" ? "Target" : ""}</div>
    <div>${answer !== "0" ? "Answer" : ""}</div>
    <div>${limit !== "0" ? "Limit" : ""}</div>
    <div style=${{ justifySelf: "center" }}>Score</div>
  </div>`;

  const sampleCount = items?.reduce((prev, current) => {
    if (current.type === "sample") {
      return prev + 1;
    } else {
      return prev;
    }
  }, 0);
  const footerRow = html` <div
    style=${{
      borderTop: "solid var(--bs-light-border-subtle) 1px",
      background: "var(--bs-light-bg-subtle)",
      fontSize: FontSize.smaller,
      display: "grid",
      gridTemplateColumns: "max-content",
      justifyContent: "end",
      alignContent: "end",
      padding: "0.2em 1em",
    }}
  >
    <div>${sampleCount} Samples</div>
  </div>`;

  // Count any sample errors and display a bad alerting the user
  // to any errors
  const errorCount = items?.reduce((previous, item) => {
    // @ts-expect-error
    if (item.data.error) {
      return previous + 1;
    } else {
      return previous;
    }
  }, 0);

  // Count limits
  const limitCount = items?.reduce((previous, item) => {
    // @ts-expect-error
    if (item.data.limit) {
      return previous + 1;
    } else {
      return previous;
    }
  }, 0);

  const percentError = (errorCount / sampleCount) * 100;
  const percentLimit = (limitCount / sampleCount) * 100;
  const warningMessage =
    errorCount > 0
      ? `INFO: ${errorCount} of ${sampleCount} samples (${formatNoDecimal(percentError)}%) had errors and were not scored.`
      : limitCount
        ? `INFO: ${limitCount} of ${sampleCount} samples (${formatNoDecimal(percentLimit)}%) completed due to exceeding a limit.`
        : undefined;

  const warningRow = warningMessage
    ? html`<${MessageBand}
        message=${warningMessage}
        hidden=${hidden}
        setHidden=${setHidden}
        type="info"
      />`
    : "";

  return html` <div
    style=${{ display: "flex", flexDirection: "column", width: "100%" }}
  >
    ${warningRow} ${headerRow}
    <${VirtualList}
      ref=${listRef}
      data=${items}
      tabIndex="0"
      renderRow=${renderRow}
      onkeydown=${onkeydown}
      style=${listStyle}
    />
    ${footerRow}
  </div>`;
};

const SeparatorRow = ({ id, title, height }) => {
  return html`<div
    id=${id}
    style=${{
      padding: ".25em 1em .25em 1em",
      textTransform: "uppercase",
      ...TextStyle.secondary,
      fontSize: FontSize.smaller,
      fontWeight: 600,
      borderBottom: "solid 1px var(--bs-border-color)",
      height: `${height}px`,
    }}
  >
    <div>${title}</div>
  </div>`;
};

/**
 * @param {Object} props - The parameters for the component.
 * @param {string} props.id - The unique identifier for the sample.
 * @param {number} props.index - The index of the sample.
 * @param {import("../api/Types.mjs").SampleSummary} props.sample - The sample.
 * @param {import("../samples/SamplesDescriptor.mjs").SamplesDescriptor} props.sampleDescriptor - The sample descriptor.
 * @param {number} props.height - The height of the sample row.
 * @param {boolean} props.selected - Whether the sample is selected.
 * @param {(index: number) => void} props.showSample - The function to show the sample.
 * @returns {import("preact").JSX.Element} The SampleRow component.
 */
const SampleRow = ({
  id,
  index,
  sample,
  sampleDescriptor,
  height,
  selected,
  showSample,
}) => {
  const selectedStyle = selected
    ? {
        boxShadow: "inset 0 0 0px 2px var(--bs-focus-ring-color)",
      }
    : {};

  const cellStyle = {
    paddingLeft: "0em",
    paddingRight: "0em",
  };

  return html`
    <div
      id=${`sample-${id}`}
      onclick=${() => {
        showSample(index);
      }}
      style=${{
        height: `${height}px`,
        display: "grid",
        ...gridColumnStyles(sampleDescriptor),
        paddingTop: "1em",
        paddingBottom: "1em",
        gridTemplateRows: `${height - 28}px`,
        fontSize: FontSize.base,
        borderBottom: "solid var(--bs-border-color) 1px",
        cursor: "pointer",
        ...selectedStyle,
        overflowY: "hidden",
      }}
    >
      <div
        class="sample-id"
        style=${{ ...cellStyle, ...ApplicationStyles.threeLineClamp }}
      >
        ${sample.id}
      </div>
      <div
        class="sample-input"
        style=${{
          ...ApplicationStyles.threeLineClamp,
          wordWrap: "anywhere",
          ...cellStyle,
        }}
      >
        ${inputString(sample.input).join(" ")}
      </div>
      <div
        class="sample-target"
        style=${{
          ...ApplicationStyles.threeLineClamp,
          ...cellStyle,
        }}
      >
        <${MarkdownDiv}
          markdown=${arrayToString(sample?.target)}
          style=${{ paddingLeft: "0" }}
          class="no-last-para-padding"
        />
      </div>
      <div
        class="sample-answer"
        style=${{
          ...ApplicationStyles.threeLineClamp,
          ...cellStyle,
        }}
      >
        ${sample
          ? html`
              <${MarkdownDiv}
                markdown=${sampleDescriptor
                  ?.selectedScorerDescriptor(sample)
                  .answer()}
                style=${{ paddingLeft: "0" }}
                class="no-last-para-padding"
              />
            `
          : ""}
      </div>
      <div
        class="sample-limit"
        style=${{
          fontSize: FontSize.small,
          ...ApplicationStyles.threeLineClamp,
          ...cellStyle,
        }}
      >
        ${sample.limit}
      </div>

      <div
        style=${{
          fontSize: FontSize.small,
          ...cellStyle,
          display: "flex",
          justifySelf: "center",
        }}
      >
        ${sample.error
          ? html`<${SampleError} message=${sample.error} />`
          : sampleDescriptor?.selectedScore(sample).render()}
      </div>
    </div>
  `;
};

const gridColumnStyles = (sampleDescriptor) => {
  const { input, target, answer, limit, id, score } =
    gridColumns(sampleDescriptor);
  return {
    gridGap: "10px",
    gridTemplateColumns: `${id} ${input} ${target} ${answer} ${limit} ${score}`,
    paddingLeft: "1rem",
    paddingRight: "1rem",
  };
};

const gridColumns = (sampleDescriptor) => {
  const input =
    sampleDescriptor?.messageShape.normalized.input > 0
      ? Math.max(0.15, sampleDescriptor.messageShape.normalized.input)
      : 0;
  const target =
    sampleDescriptor?.messageShape.normalized.target > 0
      ? Math.max(0.15, sampleDescriptor.messageShape.normalized.target)
      : 0;
  const answer =
    sampleDescriptor?.messageShape.normalized.answer > 0
      ? Math.max(0.15, sampleDescriptor.messageShape.normalized.answer)
      : 0;
  const limit =
    sampleDescriptor?.messageShape.normalized.limit > 0
      ? Math.max(0.15, sampleDescriptor.messageShape.normalized.limit)
      : 0;
  const id = Math.max(2, Math.min(10, sampleDescriptor?.messageShape.raw.id));
  const score = Math.max(
    3,
    Math.min(10, sampleDescriptor?.messageShape.raw.score),
  );

  const frSize = (val) => {
    if (val === 0) {
      return "0";
    } else {
      return `${val}fr`;
    }
  };

  return {
    input: frSize(input),
    target: frSize(target),
    answer: frSize(answer),
    limit: frSize(limit),
    id: `${id}rem`,
    score: `${score}rem`,
  };
};
