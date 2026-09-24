import { Modal } from "./ui";

export const DISCLAIMER_KEY = "crush-monitor-disclaimer-v1";

export function DisclaimerModal({
  accepted,
  onAccept,
  onClose,
}: {
  accepted: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title="使用前请阅读"
      // Before acceptance the only way out is to accept.
      close={() => accepted && onClose()}
    >
      <div className="disclaimer">
        <h3>仅供娱乐参考</h3>
        <p>
          分析结果由大模型根据聊天文字自动生成，可能出错、片面或前后不一致。它不了解你们在聊天之外的相处，不代表对方的真实想法，也不是心理咨询或情感建议。请不要仅凭分析结果做表白、分手、冷落对方等重要决定。
        </p>
        <h3>隐私与他人信息</h3>
        <p>
          聊天记录里有对方的话和个人信息。分析时，所需的聊天片段（按设置自动打码后）会发送给你配置的模型服务商（如
          DeepSeek），由其按自己的隐私政策处理。请只分析你有权处理的聊天，尊重对方的隐私，不要把结果或原文公开传播。
        </p>
        <h3>费用</h3>
        <p>
          调用模型会从你自己的 API
          账户扣费。页面上的预计花费和已花费都是按单价估算的，服务商分时段定价、缓存命中情况都会让实际费用不同，请以服务商账单为准。可以在设置里给单次分析设花费上限。
        </p>
        <h3>禁止的用途</h3>
        <p>
          不得用于监视、跟踪、骚扰、操控或威胁他人，不得分析未经授权获取的聊天记录。未成年人请在监护人知情的情况下使用。
        </p>
        <h3>免责</h3>
        <p>
          本工具按「现状」提供，作者和改编者不对分析结果的准确性，以及因使用本工具产生的任何直接或间接后果承担责任。本项目与微信、腾讯、TypeSafe、DeepSeek
          及 OpenAI 无隶属关系。
        </p>
      </div>
      {accepted ? (
        <button className="secondary" onClick={onClose}>
          关闭
        </button>
      ) : (
        <button className="primary" onClick={onAccept}>
          我已阅读并了解，继续使用
        </button>
      )}
    </Modal>
  );
}
