use serde::Serialize;

const LATEST_RELEASE_URL: &str = "https://github.com/hugqq/ToolDock/releases/latest";

#[derive(Debug, Serialize)]
pub struct LatestRelease {
    pub tag_name: String,
    pub name: String,
    pub html_url: String,
}

pub async fn check_latest_release() -> Result<LatestRelease, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("ToolDock")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(LATEST_RELEASE_URL)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let location = response
        .headers()
        .get(reqwest::header::LOCATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| format!("GitHub latest release did not redirect: {}", response.status()))?;

    let tag_name = release_version_from_latest_url(location)
        .ok_or_else(|| "GitHub latest release redirect missing version".to_string())?;
    let html_url = if location.starts_with("http") {
        location.to_string()
    } else {
        format!("https://github.com{}", location)
    };

    Ok(LatestRelease {
        name: tag_name.clone(),
        tag_name,
        html_url,
    })
}

fn release_version_from_latest_url(url: &str) -> Option<String> {
    url.split("/releases/tag/")
        .nth(1)
        .and_then(|value| value.split(['?', '#']).next())
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

#[cfg(test)]
mod tests {
    use super::release_version_from_latest_url;

    #[test]
    fn extracts_version_from_github_latest_release_redirect_url() {
        let version = release_version_from_latest_url(
            "https://github.com/hugqq/ToolDock/releases/tag/v1.0.1",
        );

        assert_eq!(version, Some("v1.0.1".to_string()));
    }
}
