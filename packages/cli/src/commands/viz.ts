/**
 * CLI: offline visualization validate / compile / render.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import {
  VisualizationError,
  compileVisualization,
  createDataset,
  validateVisualizationSpec,
} from '@lightdash-tools/visualization';

import { parseJsonOrYaml, readFileOrStdin } from '../utils/file-input';
import { wrapAction } from '../utils/safety';

import type { Command } from 'commander';
import type { VisualizationDataset } from '@lightdash-tools/visualization';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadDataset(path: string): VisualizationDataset {
  const raw = parseJsonOrYaml(readFileSync(path, 'utf-8'));
  if (!isRecord(raw) || !Array.isArray(raw.columns) || !Array.isArray(raw.rows)) {
    throw new Error('Dataset must be a JSON/YAML object with columns[] and rows[]');
  }
  return createDataset({
    columns: raw.columns as VisualizationDataset['columns'],
    rows: raw.rows as VisualizationDataset['rows'],
    provenance: isRecord(raw.provenance) ? (raw.provenance as VisualizationDataset['provenance']) : undefined,
    truncated: typeof raw.truncated === 'boolean' ? raw.truncated : undefined,
    warnings: Array.isArray(raw.warnings) ? (raw.warnings as string[]) : undefined,
  });
}

async function loadSpec(file?: string): Promise<unknown> {
  const content = await readFileOrStdin({ file });
  return parseJsonOrYaml(content);
}

function printError(error: unknown): never {
  if (error instanceof VisualizationError) {
    console.error(JSON.stringify({ code: error.code, message: error.message, details: error.details }, null, 2));
    process.exit(1);
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

/**
 * Registers `viz` command group (offline; no Lightdash HTTP).
 */
export function registerVizCommand(program: Command): void {
  const viz = program
    .command('viz')
    .description('Validate, compile, and render Lightdash Visualization Specs (offline)');

  viz
    .command('validate')
    .description('Validate an LVS YAML/JSON document')
    .option('-f, --file <path>', 'LVS file path (YAML or JSON)')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (options: { file?: string }) => {
        try {
          const raw = await loadSpec(options.file);
          const spec = validateVisualizationSpec(raw);
          console.log(JSON.stringify({ ok: true, version: spec.version, template: spec.visual }, null, 2));
        } catch (error) {
          printError(error);
        }
      }),
    );

  viz
    .command('compile')
    .description('Compile LVS + dataset to a target artifact descriptor (JSON on stdout)')
    .requiredOption('--dataset <path>', 'Normalized dataset JSON/YAML path')
    .option('-f, --file <path>', 'LVS file path (YAML or JSON)')
    .option(
      '--target <target>',
      'Compile target: svg | standalone-html | lightdash-custom-chart',
      'lightdash-custom-chart',
    )
    .option('--embed-data', 'HTML only: embed dataset rows in output (sensitive)', false)
    .option('--strict', 'Fail on unsupported required capabilities', true)
    .option('--no-strict', 'Warn instead of failing on required capability gaps')
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (options: {
          file?: string;
          dataset: string;
          target: string;
          embedData?: boolean;
          strict?: boolean;
        }) => {
          try {
            const raw = await loadSpec(options.file);
            const dataset = loadDataset(options.dataset);
            if (
              options.target !== 'svg' &&
              options.target !== 'standalone-html' &&
              options.target !== 'lightdash-custom-chart'
            ) {
              throw new Error(`Unsupported target: ${options.target}`);
            }
            const result = compileVisualization({
              spec: raw,
              dataset,
              target: options.target,
              embedData: options.embedData === true,
              strict: options.strict,
            });
            console.log(
              JSON.stringify(
                {
                  target: result.target,
                  templateId: result.templateId,
                  warnings: result.warnings,
                  capability: result.capability,
                  customChart: result.customChart,
                  svg: result.target === 'svg' ? result.svg : undefined,
                  html: result.target === 'standalone-html' ? result.html : undefined,
                },
                null,
                2,
              ),
            );
          } catch (error) {
            printError(error);
          }
        },
      ),
    );

  viz
    .command('render')
    .description('Render LVS + dataset to an SVG or HTML file')
    .requiredOption('--dataset <path>', 'Normalized dataset JSON/YAML path')
    .option('-f, --file <path>', 'LVS file path (YAML or JSON)')
    .option('--format <format>', 'Output format: svg | html', 'svg')
    .option('-o, --output <path>', 'Output file path')
    .option('--embed-data', 'HTML only: embed dataset rows (sensitive)', false)
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (options: {
          file?: string;
          dataset: string;
          format: string;
          output?: string;
          embedData?: boolean;
        }) => {
          try {
            const raw = await loadSpec(options.file);
            const dataset = loadDataset(options.dataset);
            const target = options.format === 'html' ? 'standalone-html' : 'svg';
            if (options.format !== 'svg' && options.format !== 'html') {
              throw new Error(`Unsupported format: ${options.format}`);
            }
            const result = compileVisualization({
              spec: raw,
              dataset,
              target,
              embedData: options.embedData === true,
              strict: false,
            });
            const body = options.format === 'html' ? result.html : result.svg;
            if (!body) {
              throw new Error('Renderer produced empty output');
            }
            if (options.output) {
              writeFileSync(options.output, body, 'utf-8');
              console.log(JSON.stringify({ ok: true, output: options.output, warnings: result.warnings }, null, 2));
            } else {
              process.stdout.write(body);
            }
          } catch (error) {
            printError(error);
          }
        },
      ),
    );
}
