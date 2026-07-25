"""
generate_sample_pdf.py - Generates the Enterprise_SOP_Guide.pdf sample document.
Run this script once: python generate_sample_pdf.py
Requires: pypdf or reportlab. Uses built-in pypdf canvas approach.
"""
import sys
from pathlib import Path

OUTPUT_PATH = Path(__file__).parent / "Enterprise_SOP_Guide.pdf"

SOP_CONTENT = """TECHCORP ENTERPRISES
STANDARD OPERATING PROCEDURES (SOP) GUIDE
IT Operations & Platform Engineering | Version 2.4 | January 2026

=============================================================
PURPOSE
=============================================================

This Standard Operating Procedures (SOP) guide documents the
repeatable processes, escalation paths, and operational runbooks
for TechCorp's IT Operations and Platform Engineering teams.

All on-call engineers and DevOps personnel are required to follow
these procedures during normal operations and incident response.

=============================================================
SOP-001: PRODUCTION DEPLOYMENT PROCEDURE
=============================================================

Objective: Ensure safe, auditable, zero-downtime deployments
to production environments.

Prerequisites:
- All automated tests pass in CI pipeline (GitHub Actions).
- Code review approved by at least 2 senior engineers.
- Change Request (CR) ticket created in ServiceNow with CR number.
- Deployment window: Monday–Thursday, 10:00 AM – 3:00 PM EST.
  (No deployments on Fridays or weekends without CISO/CTO approval.)
- Deployment owner must be available for 2 hours post-deployment.

Steps:
1. Announce deployment in #deployments Slack channel with CR number.
2. Verify staging environment matches production configuration.
3. Run pre-deployment checklist (see Appendix A).
4. Execute deployment via ArgoCD (Kubernetes) or AWS CodeDeploy.
5. Monitor health dashboards for 30 minutes post-deployment.
6. Confirm all smoke tests pass.
7. Update ServiceNow CR ticket to "Deployed - Monitoring".
8. Post deployment summary in #deployments after 30-minute monitoring window.

Rollback Trigger: Any of the following triggers immediate rollback:
- Error rate > 1% of requests within 10 minutes.
- P95 latency exceeds 3x baseline.
- Any critical alert in PagerDuty during monitoring window.
- Customer-impacting bug reported via support channel.

Rollback Steps:
1. Execute rollback command in ArgoCD / CodeDeploy.
2. Notify #deployments and #incidents immediately.
3. Create P1/P2 incident in PagerDuty.
4. Initiate incident response per SOP-003.

=============================================================
SOP-002: DATABASE BACKUP & RECOVERY PROCEDURE
=============================================================

Objective: Ensure database integrity and recoverability.

Backup Schedule:
- Production RDS (PostgreSQL): Full backup daily at 02:00 UTC.
  Automated snapshots every 4 hours. Retention: 35 days.
- Analytics DWH (Snowflake): Daily export to S3 at 03:00 UTC.
  Retention: 90 days.
- MongoDB Atlas: Continuous backup with point-in-time recovery.
  Retention: 14 days.

Recovery Procedure (Database Restore):
1. Raise a P1 incident in PagerDuty; notify DBA on-call.
2. Identify Recovery Point Objective (RPO): What is the latest
   acceptable recovery point?
3. Select the appropriate backup snapshot from AWS RDS console
   or the backup management dashboard.
4. Launch restore to a new isolated RDS instance first.
5. Validate data integrity with the pre-defined integrity check script.
6. Coordinate with application teams for read-only failover.
7. Execute DNS cutover to restored instance.
8. Notify stakeholders and close incident.

RTO Target: 4 hours for full database recovery.
RPO Target: Maximum 4 hours data loss.

Backup Verification:
All backup restorations are tested quarterly in a non-production
environment by the DBA team. Results are reported to the CISO.

=============================================================
SOP-003: ON-CALL INCIDENT RESPONSE RUNBOOK
=============================================================

Objective: Standardize how on-call engineers respond to alerts
and incidents.

On-Call Schedule:
- Primary On-Call: Rotates weekly among senior engineers.
- Secondary On-Call: Escalation from Primary.
- Manager On-Call: Available for P1 escalations.
- Schedule managed in PagerDuty.

When an Alert Fires:
1. Acknowledge the PagerDuty alert within 5 minutes.
2. Assess severity: P1 / P2 / P3 / P4 (see Cloud Security Guide).
3. Create incident channel in Slack: #inc-YYYYMMDD-{description}.
4. Post incident details: what is affected, start time, impact.
5. Begin triage:
   a. Check recent deployments (last 6 hours).
   b. Review dashboards: Datadog, CloudWatch, Grafana.
   c. Check ChromaDB and service health endpoints.
   d. Review application logs in Splunk (search for ERROR/CRITICAL).
6. Escalate if not resolved within SLA (see severity levels).
7. Implement fix or rollback.
8. Verify resolution via monitoring dashboards.
9. Close incident channel and write brief incident summary.
10. Schedule Post-Incident Review (PIR) for P1/P2.

Communication Template (P1):
"INCIDENT | P1 | [Short Description]
Status: Investigating / Mitigating / Resolved
Impact: [What is affected, number of customers impacted]
Started: [Time UTC]
Updates: Every 15 minutes until resolved."

=============================================================
SOP-004: ACCESS PROVISIONING & DEPROVISIONING
=============================================================

New Employee Access Provisioning:
1. Manager submits access request via IT Portal 3 days before start date.
2. IT creates Azure AD account and assigns base role (Employee-Base).
3. IT provisions SSO access for Microsoft 365, Slack, Jira, Confluence.
4. Role-specific access (GitHub, AWS, production tools) granted on Day 1
   via appropriate team-specific Entra ID group.
5. MFA enrollment required before first login to any system.
6. Access provisioning must be completed by 9:00 AM on employee start date.

Employee Offboarding (Access Deprovisioning):
1. HR notifies IT at least 24 hours before last working day.
2. On last working day at EOD: Disable Azure AD account immediately.
3. Revoke all active SSO sessions.
4. Disable all API keys and service account permissions.
5. Transfer file ownership (OneDrive, SharePoint, GitHub) to manager.
6. Archive and disable email. Set up auto-reply: 6 months.
7. Collect company hardware within 5 business days.
8. Complete IT offboarding checklist in ServiceNow within 48 hours.

Immediate Termination Protocol:
HR notifies IT via phone AND email simultaneously.
Azure AD account disabled immediately (target: within 15 minutes).
All active sessions revoked within 1 hour.

=============================================================
SOP-005: CAPACITY PLANNING & SCALING PROCEDURE
=============================================================

Objective: Proactively manage infrastructure capacity to prevent
performance degradation.

Monthly Capacity Review:
1. Pull utilization metrics from Datadog for all production services.
2. Flag any service with average CPU > 60% or memory > 70%.
3. Project growth based on sales pipeline and product roadmap.
4. Submit scaling recommendations to Platform Engineering Lead.

Auto-Scaling Configuration:
- AWS EKS clusters: HPA configured for CPU threshold 70%.
- RDS: Storage auto-scaling enabled; max threshold: 10TB.
- Lambda: Reserved concurrency set per function; review monthly.
- CloudFront CDN: Capacity managed by AWS; no manual intervention.

Pre-Holiday Scaling (Thanksgiving, Christmas, End-of-Year):
Scale up primary services by 30% 1 week before holiday period.
Scale down 1 week after. Requires Platform Engineering Lead approval.

=============================================================
APPENDIX A: PRE-DEPLOYMENT CHECKLIST
=============================================================

[ ] CI/CD pipeline shows all tests green.
[ ] Staging smoke tests completed and passed.
[ ] Database migrations tested in staging (if applicable).
[ ] Feature flags configured correctly.
[ ] Rollback plan documented and reviewed.
[ ] On-call engineer identified and available.
[ ] Monitoring dashboards pulled up and ready.
[ ] Stakeholders notified of deployment window.
[ ] ServiceNow Change Request approved.
[ ] Security scan (SAST/DAST) completed with no critical findings.

=============================================================
DOCUMENT CONTROL
=============================================================

Document Owner: VP of Platform Engineering
Approved By: CTO, CISO
Last Updated: January 15, 2026
Next Review: July 2026
Classification: Confidential - Internal Use Only
"""


def generate_pdf_with_reportlab():
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_LEFT, TA_CENTER
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, HRFlowable, PageBreak
        )
        from reportlab.lib.units import inch

        doc = SimpleDocTemplate(
            str(OUTPUT_PATH),
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "Title",
            parent=styles["Title"],
            fontSize=16,
            textColor=colors.HexColor("#1a365d"),
            spaceAfter=8,
            alignment=TA_CENTER,
        )
        h2_style = ParagraphStyle(
            "H2",
            parent=styles["Heading2"],
            fontSize=12,
            textColor=colors.HexColor("#2c5282"),
            spaceBefore=14,
            spaceAfter=6,
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontSize=9,
            leading=14,
            spaceAfter=4,
        )

        story = []
        for line in SOP_CONTENT.strip().split("\n"):
            stripped = line.strip()
            if not stripped:
                story.append(Spacer(1, 6))
            elif stripped.startswith("====="):
                story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#3182ce")))
            elif stripped.startswith("SOP-") or (stripped.isupper() and len(stripped) > 5 and len(stripped) < 60):
                story.append(Paragraph(stripped, h2_style))
            else:
                story.append(Paragraph(stripped.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), body_style))

        doc.build(story)
        print(f"PDF generated: {OUTPUT_PATH}")
    except ImportError:
        generate_pdf_fallback()


def generate_pdf_fallback():
    """Create a minimal valid PDF using raw bytes if reportlab is not available."""
    content = SOP_CONTENT.encode("latin-1", errors="replace")
    # Build a very simple single-stream PDF
    lines = SOP_CONTENT.split("\n")
    page_lines = []
    for line in lines:
        # Break long lines
        while len(line) > 90:
            page_lines.append(line[:90])
            line = line[90:]
        page_lines.append(line)

    # Build PDF manually
    objects = []
    xref_positions = []

    def add_obj(content: bytes) -> int:
        idx = len(objects) + 1
        objects.append(content)
        return idx

    catalog_idx = add_obj(b"")  # placeholder
    pages_idx = add_obj(b"")    # placeholder
    font_idx = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")

    # Build page content (stream)
    stream_lines = [b"BT", b"/F1 8 Tf", b"30 800 Td", b"12 TL"]
    for ln in page_lines[:200]:  # limit to 200 lines
        safe = ln.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").replace("\r","")
        stream_lines.append(f"({safe}) Tj T*".encode("latin-1", errors="replace"))
    stream_lines.append(b"ET")
    stream_data = b"\n".join(stream_lines)

    content_idx = add_obj(
        b"<< /Length " + str(len(stream_data)).encode() + b" >>\nstream\n"
        + stream_data + b"\nendstream"
    )
    page_idx = add_obj(
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Contents " + str(content_idx).encode() + b" 0 R "
        b"/Resources << /Font << /F1 " + str(font_idx).encode() + b" 0 R >> >> >>"
    )

    # Fix placeholders
    objects[catalog_idx - 1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[pages_idx - 1] = (
        b"<< /Type /Pages /Kids [" + str(page_idx).encode() + b" 0 R] /Count 1 >>"
    )

    # Write PDF
    pdf = b"%PDF-1.4\n"
    for i, obj in enumerate(objects, 1):
        xref_positions.append(len(pdf))
        pdf += str(i).encode() + b" 0 obj\n" + obj + b"\nendobj\n"

    xref_pos = len(pdf)
    pdf += b"xref\n0 " + str(len(objects) + 1).encode() + b"\n"
    pdf += b"0000000000 65535 f \n"
    for pos in xref_positions:
        pdf += str(pos).zfill(10).encode() + b" 00000 n \n"
    pdf += b"trailer\n<< /Size " + str(len(objects) + 1).encode() + b" /Root 1 0 R >>\n"
    pdf += b"startxref\n" + str(xref_pos).encode() + b"\n%%EOF"

    OUTPUT_PATH.write_bytes(pdf)
    print(f"PDF generated (fallback mode): {OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        import reportlab
        generate_pdf_with_reportlab()
    except ImportError:
        generate_pdf_fallback()
