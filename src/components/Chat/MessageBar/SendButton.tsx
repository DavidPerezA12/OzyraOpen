import { CustomSendIcon } from './CustomSendIcon';
import { CustomSpinnerIcon } from './CustomSpinnerIcon';
import { CustomStopIcon } from './CustomStopIcon';

interface SendButtonProps {
  readonly isLoading: boolean;
  readonly canSubmit: boolean;
  readonly cancelGeneration?: () => void;
}

export const SendButton = ({ isLoading, canSubmit, cancelGeneration }: SendButtonProps) => (
  <button
    type="submit"
    onClick={(e) => {
      if (isLoading && cancelGeneration) {
        e.preventDefault();
        cancelGeneration();
      }
    }}
    disabled={isLoading ? false : !canSubmit}
    className="composer-send-btn"
    aria-label={
      isLoading ? (cancelGeneration ? 'Detener generación' : 'Generando...') : 'Enviar mensaje'
    }
  >
    {isLoading ? cancelGeneration ? <CustomStopIcon /> : <CustomSpinnerIcon /> : <CustomSendIcon />}
  </button>
);
