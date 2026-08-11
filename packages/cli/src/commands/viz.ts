import { writeFileSync } from 'node:fs';

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import {
  VisualizationError,
  compileVisualization,
  parseVisualizationDataset,
  validateVisualizationSpec,
} from '@lightdash-tools/visualization';

import { readParsedInput } from '../utils/file-input';
import { wrapAction } from '../utils/safety';

import type { Command } from 'commander';

function printError(error: unknown): never {
  if (error instanceof VisualizationError) {
    console.error(
      JSON.stringify({ code: error.code, message: error.message, details: error.details }, null, 2),
    );
    process.exit(1);
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

async function runVizAction(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    printError(error);
  }
}

async function loadDataset(path: string) {
  const raw = await readParsedInput({ file: path });
  return parseVisualizationDataset(raw);
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
        await runVizAction(async () => {
          const raw = await readParsedInput({ file: options.file });
          const spec = validateVisualizationSpec(raw);
          console.log(
            JSON.stringify({ ok: true, version: spec.version, template: spec.visual }, null, 2),
          );
        });
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
          await runVizAction(async () => {
            const raw = await readParsedInput({ file: options.file });
            const dataset = await loadDataset(options.dataset);
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
          });
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
    .option('--strict', 'Fail on unsupported required capabilities', true)
    .option('--no-strict', 'Warn instead of failing on required capability gaps')
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (options: {
          file?: string;
          dataset: string;
          format: string;
          output?: string;
          embedData?: boolean;
          strict?: boolean;
        }) => {
          await runVizAction(async () => {
            const raw = await readParsedInput({ file: options.file });
            const dataset = await loadDataset(options.dataset);
            if (options.format !== 'svg' && options.format !== 'html') {
              throw new Error(`Unsupported format: ${options.format}`);
            }
            const target = options.format === 'html' ? 'standalone-html' : 'svg';
            const result = compileVisualization({
              spec: raw,
              dataset,
              target,
              embedData: options.embedData === true,
              strict: options.strict,
            });
            const body = options.format === 'html' ? result.html : result.svg;
            if (!body) {
              throw new Error('Renderer produced empty output');
            }
            if (options.output) {
              writeFileSync(options.output, body, 'utf-8');
              console.log(
                JSON.stringify(
                  { ok: true, output: options.output, warnings: result.warnings },
                  null,
                  2,
                ),
              );
            } else {
              process.stdout.write(body);
            }
          });
        },
      ),
    );
}
