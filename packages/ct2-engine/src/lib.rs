use ct2rs::{
    Config, Device, TranslationOptions, Translator, tokenizers::auto::Tokenizer as AutoTokenizer,
};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::path::PathBuf;
use std::sync::Mutex;

#[napi(object)]
pub struct Ct2TranslatorOptions {
    pub model_path: String,
    pub device: Option<String>,
    pub threads: Option<u32>,
}

#[napi(object)]
pub struct TranslateBatchOptions {
    pub beam_size: Option<u32>,
    pub max_batch_size: Option<u32>,
    pub return_scores: Option<bool>,
}

#[napi(object)]
pub struct TranslationResult {
    pub text: String,
    pub score: Option<f64>,
}

#[napi]
pub struct Ct2Translator {
    inner: Mutex<Translator<AutoTokenizer>>,
}

#[napi]
impl Ct2Translator {
    #[napi(constructor)]
    pub fn new(options: Ct2TranslatorOptions) -> Result<Self> {
        let mut config = Config::default();
        config.device = parse_device(options.device.as_deref())?;
        if let Some(value) = options.threads {
            config.num_threads_per_replica = value as usize;
        }

        let translator = Translator::new(PathBuf::from(options.model_path), &config)
            .map_err(|error| Error::from_reason(format!("failed to load CT2 model: {error}")))?;

        Ok(Self {
            inner: Mutex::new(translator),
        })
    }

    #[napi]
    pub async fn translate_batch(
        &self,
        source: Vec<String>,
        options: Option<TranslateBatchOptions>,
    ) -> Result<Vec<TranslationResult>> {
        let mut translation_options = TranslationOptions::default();
        if let Some(options) = options {
            if let Some(value) = options.beam_size {
                translation_options.beam_size = value as usize;
            }
            if let Some(value) = options.max_batch_size {
                translation_options.max_batch_size = value as usize;
            }
            if let Some(value) = options.return_scores {
                translation_options.return_scores = value;
            }
        }
        self.run_translate(source, translation_options)
    }
}

impl Ct2Translator {
    fn run_translate(
        &self,
        source: Vec<String>,
        options: TranslationOptions<String, String>,
    ) -> Result<Vec<TranslationResult>> {
        let translator = self
            .inner
            .lock()
            .map_err(|_| Error::from_reason("ct2 translator mutex poisoned".to_string()))?;

        let results = translator
            .translate_batch(&source, &options, None)
            .map_err(|error| Error::from_reason(format!("ct2 translation failed: {error}")))?;

        Ok(results
            .into_iter()
            .map(|(text, score)| TranslationResult {
                text,
                score: score.map(|value| value as f64),
            })
            .collect())
    }
}

fn parse_device(value: Option<&str>) -> Result<Device> {
    match value.unwrap_or("cpu").to_ascii_lowercase().as_str() {
        "cpu" => Ok(Device::CPU),
        "cuda" => Ok(Device::CUDA),
        other => Err(Error::from_reason(format!(
            "unsupported CT2 device: {other}"
        ))),
    }
}
